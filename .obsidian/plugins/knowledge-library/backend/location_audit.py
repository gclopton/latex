"""Read-only, paged discovery of saved component moves after a vault restart.

The returned paths are nominations, not permission to write: the existing
observer still checks writing scope, drafts, saved bytes and journal heads.
The caller passes the opaque cursor back and observes destinations before
changed/missing sources after discovery has finished.
"""
from pathlib import Path
import stat

from component_identities import base, note_key
from markdown_scan import components


def _key(row):
    identity, at = row.get('id'), row.get('at')
    return (base(identity), at) if identity and at else None


def _signature(rows):
    # Order and presentation/content hashes matter even when no key was lost.
    return [(_key(row), row.get('hash')) for row in rows]


def _read(live, path):
    """A failed/unknown read must never be reported as a deletion."""
    try:
        mode = live.path(path).stat().st_mode
    except FileNotFoundError:
        return None
    if not stat.S_ISREG(mode):
        return None
    if not live.exact_note_exists(path):
        return None
    return live.read(path)


def _dead_home_keys(live, registry):
    keys = set()
    for identity, entry in live.store.entries.items():
        home = entry.get('home', {})
        if home.get('markerFormat') != 'component-v1' or not live.owns(entry):
            continue
        at = home.get('occurrenceId')
        occurrence = registry.occurrences.get(at)
        if at and (not occurrence or not occurrence.get('alive')):
            keys.add((identity, at))
        # Include the current canonical home too if the entry still records an
        # older location. This is the source-observed-before-destination crash.
        entity = registry.entities.get(identity)
        at = entity.get('home') if entity else None
        occurrence = registry.occurrences.get(at)
        if at and (not occurrence or not occurrence.get('alive')):
            keys.add((identity, at))
    return keys


def _directory(live, relative):
    path = live.vault / relative
    if not path.resolve().is_relative_to(live.vault):
        raise ValueError('Audit directory is outside the enrolled vault.')
    if relative and any(part.startswith('.') for part in Path(relative).parts):
        raise ValueError('Audit directory is hidden infrastructure.')
    return path


def audit(live, cursor=None, limit=100):
    """Return one bounded page, retaining discovery keys only in the cursor.

    Registered pages inspect at most 100 notes; search pages visit at most
    100 directory entries (and therefore read no more than 100 notes). A
    directory cursor records its last visited name, not a persistent index.
    Unknown paths are returned separately for the caller's existing retry.
    """
    limit = max(1, min(100, int(limit)))
    registry = live.component_registry()
    registry.load()
    state = dict(cursor or {'phase': 'registered', 'after': None, 'keys': []})
    if state.get('phase') not in ('registered', 'search'):
        raise ValueError('Invalid location-audit cursor.')
    keys = {tuple(key) for key in state.get('keys', [])}
    keys.update(_dead_home_keys(live, registry))
    result = {'phase': state['phase'], 'changedPaths': [], 'missingPaths': [],
              'destinationPaths': [], 'unknownPaths': [], 'scanned': 0}

    def unknown(path, error):
        result['unknownPaths'].append({'path': path, 'reason': str(error)})

    if state['phase'] == 'registered':
        prefix = live.vault_id + '\n'
        paths = sorted(key[len(prefix):] for key in registry.notes.keys()
                       if key.startswith(prefix))
        after = state.get('after')
        remaining = [path for path in paths if after is None or path > after]
        page = remaining[:limit]
        for path in page:
            result['scanned'] += 1
            previous = registry.notes.get(note_key(live.vault_id, path), {}).get('rows', [])
            try:
                text = _read(live, path)
                if text is None:
                    # Empty note rows are a retained deletion tombstone. The
                    # source has already been observed; enqueueing it again
                    # would create a fresh no-op plan/intent on every startup.
                    if previous:
                        result['missingPaths'].append(path)
                    keys.update(key for row in previous if (key := _key(row)))
                    continue
                current = components(text)
                before = {key for row in previous if (key := _key(row))}
                now = {key for row in current if (key := _key(row))}
                keys.update(before - now)
                if _signature(previous) != _signature(current):
                    result['changedPaths'].append(path)
            except (OSError, UnicodeError, ValueError) as error:
                unknown(path, error)
        if len(remaining) > len(page):
            state = {'phase': 'registered', 'after': page[-1]}
        elif keys:
            state = {'phase': 'search', 'stack': [{'path': '', 'after': None}]}
        else:
            state = None
    else:
        stack = [dict(frame) for frame in state.get('stack', [])]
        while stack and result['scanned'] < limit:
            frame = stack[-1]
            relative = frame['path']
            try:
                directory = _directory(live, relative)
                children = sorted(directory.iterdir(), key=lambda path: path.name)
            except (OSError, ValueError) as error:
                unknown(relative, error)
                stack.pop()
                continue
            children = [path for path in children
                        if frame.get('after') is None or path.name > frame['after']]
            if not children:
                stack.pop()
                continue
            for child in children:
                if result['scanned'] >= limit:
                    break
                frame['after'] = child.name
                result['scanned'] += 1
                path = child.relative_to(live.vault).as_posix()
                if child.name.startswith('.'):
                    continue
                try:
                    mode = child.lstat().st_mode
                    if stat.S_ISDIR(mode):
                        stack.append({'path': path, 'after': None})
                        break
                    # Do not follow directory links or escape the enrolled
                    # vault through a linked note; normal observer guards are
                    # still authoritative for ordinary contained paths.
                    if not stat.S_ISREG(mode) or child.suffix != '.md':
                        continue
                    text = _read(live, path)
                    if text is not None and any(_key(row) in keys for row in components(text)):
                        result['destinationPaths'].append(path)
                except (OSError, UnicodeError, ValueError) as error:
                    unknown(path, error)
        state = {'phase': 'search', 'stack': stack} if stack else None
    if state is not None:
        state['keys'] = [list(key) for key in sorted(keys)]
    return {**result, 'cursor': state, 'done': state is None}
