"""Optional exact-note write boundary for a bounded production pilot."""
import json
from pathlib import Path, PurePosixPath
from library_store import Conflict

def allowed(vault, path):
    from pilot_config import read
    try:
        value=read(vault)
        if 'componentWritePaths' not in value:return True
        paths=value['componentWritePaths']
        if not isinstance(paths,list) or any(not isinstance(p,str) or not p.endswith('.md') or p.startswith('/') or any(s in ('','.', '..') for s in p.split('/')) for p in paths):return False
        return path in paths
    except (OSError,ValueError,TypeError):return False

def guard(vault,path):
    if not allowed(vault,path):raise Conflict('This note is outside the enabled callout pilot. No identity or reference changes were applied.')
