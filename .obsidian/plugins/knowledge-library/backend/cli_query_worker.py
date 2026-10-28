"""Short-lived local read worker. Reuses ReviewedService; no Obsidian dependency."""
import hashlib,json,os,socket,subprocess,sys,tempfile,time,fcntl
from pathlib import Path

LIMIT=1024*1024

def location(args):
    version=[(p.name,p.stat().st_mtime_ns,p.stat().st_size) for p in Path(__file__).parent.glob('*.py')]
    key=hashlib.sha256(json.dumps([version,str(Path(args.get('root') or '').resolve()),str(Path(args['vault']).resolve()),args.get('test',False)]).encode()).hexdigest()[:24]
    folder=Path(tempfile.gettempdir())/('kl-cli-'+str(os.getuid()))
    folder.mkdir(mode=0o700,exist_ok=True)
    if folder.stat().st_uid!=os.getuid() or folder.stat().st_mode&0o077:raise ValueError('CLI worker directory has unsafe ownership or permissions')
    return folder/(key+'.sock')

def exchange(path,args):
    with socket.socket(socket.AF_UNIX) as client:
        client.settimeout(30);client.connect(str(path));client.sendall(json.dumps(args).encode()+b'\n');data=b''
        while not data.endswith(b'\n'):
            part=client.recv(65536)
            if not part:raise ValueError('CLI read worker closed unexpectedly')
            data+=part
            if len(data)>LIMIT:raise ValueError('Read response too large; narrow the query')
    result=json.loads(data)
    if 'error' in result:raise ValueError(result['error'])
    return result['result']

def call(args):
    args={k:str(v) if isinstance(v,Path) else v for k,v in args.items()};path=location(args)
    try:return exchange(path,args)
    except (FileNotFoundError,ConnectionRefusedError):pass
    with path.with_suffix('.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        try:return exchange(path,args)
        except (FileNotFoundError,ConnectionRefusedError):pass
        process=subprocess.Popen([sys.executable,str(Path(__file__).resolve()),str(path),json.dumps(args)],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
        deadline=time.monotonic()+30
        while time.monotonic()<deadline:
            try:return exchange(path,args)
            except (FileNotFoundError,ConnectionRefusedError):
                if process.poll() is not None:raise ValueError('CLI read worker could not start')
                time.sleep(.02)
        raise ValueError('CLI read worker startup timed out')

def serve(path,args):
    from types import SimpleNamespace
    from library_cli import execute
    from reviewed_service import ReviewedService
    from deploy import DEFAULT_LIBRARY
    import secrets
    service=ReviewedService(args.get('root') or DEFAULT_LIBRARY,args['vault'],secrets.token_urlsafe(32),production=not args.get('test',False))
    path=Path(path);path.unlink(missing_ok=True)
    with socket.socket(socket.AF_UNIX) as server:
        server.bind(str(path));os.chmod(path,0o600);server.listen(4);server.settimeout(120)
        try:
            while True:
                try:client,_=server.accept()
                except TimeoutError:break
                with client:
                    client.settimeout(10);data=b''
                    try:
                        while not data.endswith(b'\n'):
                            part=client.recv(65536)
                            if not part or len(data)+len(part)>LIMIT:raise ValueError('Invalid query request')
                            data+=part
                        request=json.loads(data)
                        if location(request)!=path or request['operation'] not in ('search','batch','get','resolve','outline'):raise ValueError('Read worker scope mismatch')
                        result={'result':execute(SimpleNamespace(**request),service)}
                    except Exception as error:result={'error':str(error)}
                    payload=json.dumps(result,ensure_ascii=False).encode()+b'\n'
                    if len(payload)>LIMIT:payload=b'{"error":"Read response too large; narrow the query"}\n'
                    try:client.sendall(payload)
                    except OSError:pass
        finally:path.unlink(missing_ok=True)

if __name__=='__main__':serve(sys.argv[1],json.loads(sys.argv[2]))
