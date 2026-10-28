"""Installer-owned pilot scope survives older runtimes rewriting vault.json."""
import json
from pathlib import Path

FAIL_CLOSED={'componentWritePaths':[], 'numbering':{'titleMode':'source'}}
def authority(vault):
    root=Path(vault)/'.knowledge-library'
    return root/'pilot.json' if (root/'pilot-required').exists() or (root/'pilot.json').exists() else root/'vault.json'
def read(vault):
    file=authority(vault);pilot=file.name=='pilot.json'
    try:
        value=json.loads(file.read_text()) if file.exists() else {}
        if not isinstance(value,dict):raise ValueError('Configuration must be an object')
        if pilot:
            paths=value.get('componentWritePaths')
            if not isinstance(paths,list) or any(not isinstance(p,str) or not p.endswith('.md') or p.startswith('/') or any(s in ('','.', '..') for s in p.split('/')) for p in paths):raise ValueError('Pilot paths missing or invalid')
            if value.get('numbering',{}).get('titleMode')!='source':raise ValueError('Pilot source-title policy missing')
        return value
    except (OSError,ValueError,TypeError,AttributeError):
        if pilot:return {**FAIL_CLOSED,'pilotIssue':'Pilot settings are unavailable; callout writes are disabled and source titles are preserved.'}
        raise
