"""Host-level index role: exactly one writer Mac, every other host is a reader.

The role lives in ONE host-level file outside every vault and every synced
repository (default ~/Library/Application Support/Knowledge Library/host-role.json,
{"role": "writer"}), so no sync can carry it to the other Mac and one Mac never
has different roles in different vaults. Anything other than an explicit
"writer" is a reader: a missing, damaged or unknown file cannot enable writes.
Per-vault plugin settings are never consulted.
"""
import json
from pathlib import Path
from library_store import Conflict

WRITER='writer'
READER='reader'


class ReaderHost(Conflict):
    """A write was attempted on a reader host. Nothing was written."""
    code='reader-host'

    def __init__(self,action='This change'):
        super().__init__('Reader host: '+action+' is applied only by the writer Mac. Send it as an index request.')


def normalize(value):
    return WRITER if value==WRITER else READER


def role_file():
    import os
    override=os.environ.get('KL_HOST_ROLE_FILE')
    return Path(override) if override else Path.home()/'Library'/'Application Support'/'Knowledge Library'/'host-role.json'


def configured(vault=None,production=True):
    """This host's role from the host-level file; failures mean reader."""
    try:
        value=json.loads(role_file().read_text())
        return normalize(value.get('role') if isinstance(value,dict) else None)
    except (OSError,ValueError):
        return READER


def effective(vault,production,requested=None):
    """Role for one backend process.

    Production: writer only when the caller did not ask for less AND the vault's
    host-local settings say writer. The isolated TEST/lab collection keeps its
    historical writer behavior unless a caller explicitly asks for reader.
    """
    if not production:
        return READER if requested is not None and normalize(requested)==READER else WRITER
    if requested is not None and normalize(requested)!=WRITER:
        return READER
    return configured(vault,True)


def require_writer(holder,action):
    """Raise before any shared-store, identity, marker or note write on a reader."""
    if holder is None or getattr(holder,'reader',False):
        raise ReaderHost(action)
