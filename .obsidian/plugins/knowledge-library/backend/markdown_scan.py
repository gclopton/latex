"""Shared Lezer scanner bridge. One process per service, one scan per document."""
import atexit
import json
import os
from pathlib import Path
import select
import shutil
import subprocess
import threading

_UNSET=object()


class MarkdownScanner:
    def __init__(self):
        self.process=None
        self.lock=threading.RLock()
        self.sequence=0
        self.error_tail=b''

    def close(self):
        with self.lock:
            process,self.process=self.process,None
            if process:
                if process.poll() is None:
                    process.terminate()
                    try:process.wait(timeout=2)
                    except subprocess.TimeoutExpired:process.kill();process.wait()
                for stream in (process.stdin,process.stdout,process.stderr):
                    if stream:stream.close()

    def scan(self,text,numbering_patch=_UNSET,components=False):
        with self.lock:
            if self.process is None or self.process.poll() is not None:
                self.close()
                candidates=[os.environ.get('KL_NODE_BINARY'),shutil.which('node'),'/opt/homebrew/bin/node','/usr/local/bin/node']
                executable=None
                environment=os.environ.copy();environment.pop('ELECTRON_RUN_AS_NODE',None)
                for candidate in dict.fromkeys(x for x in candidates if x):
                    if not Path(candidate).is_file():continue
                    # Never probe Electron/app binaries: some Obsidian installers
                    # ignore RUN_AS_NODE and open a window instead of running JS.
                    if Path(candidate).name not in ('node','node.exe'):continue
                    try:
                        version=subprocess.run([candidate,'--version'],env=environment,capture_output=True,text=True,timeout=3)
                        if version.returncode==0 and int(version.stdout.strip().lstrip('v').split('.')[0])>=18:
                            executable=candidate;break
                    except (OSError,ValueError,subprocess.TimeoutExpired):continue
                if executable is None:raise RuntimeError('Markdown scanner requires an installed Node 18+ runtime; configure KL_NODE_BINARY if it is outside standard locations')
                self.process=subprocess.Popen([executable,str(Path(__file__).with_name('scan_markdown.cjs'))],
                    stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=environment)
                self.error_tail=b''
                def errors(stream):
                    try:
                        while chunk:=stream.read1(2048):self.error_tail=(self.error_tail+chunk)[-2048:]
                    except (OSError,ValueError):pass
                threading.Thread(target=errors,args=(self.process.stderr,),daemon=True).start()
            self.sequence+=1
            request=json.dumps({'id':self.sequence,'text':text,'components':components,**({'numberingPatch':numbering_patch} if numbering_patch is not _UNSET else {})},ensure_ascii=True).encode()+b'\n'
            try:
                self.process.stdin.write(request);self.process.stdin.flush()
                if not select.select([self.process.stdout],[],[],15)[0]:raise RuntimeError('Markdown scanner timed out')
                line=self.process.stdout.readline()
                if not line:raise RuntimeError('Markdown scanner stopped: '+self.error_tail.decode('utf-8','replace'))
                result=json.loads(line)
                if result.get('error'):raise RuntimeError(result['error'])
                if result.get('id')!=self.sequence or result.get('offsetUnit')!='utf16':raise RuntimeError('Markdown scanner response mismatch')
            except Exception:
                self.close();raise
        # JavaScript uses UTF-16; Python refresh edits use Unicode code points.
        needed={n for key in ('protected','math','links') for pair in result[key] for n in pair}
        needed.update(n for row in result['structure'] for n in (row['from'],row['to']))
        needed.update(row[k] for row in result.get('components',[]) for k in ('from','to','headerTo','foldFrom'))
        if 'numberingEdit' in result:needed.update(result['numberingEdit'][key] for key in ('start','end'))
        positions={0:0};offset=0
        for i,char in enumerate(text,1):
            offset+=2 if ord(char)>0xffff else 1
            if offset in needed:positions[offset]=i
        if not needed.issubset(positions):raise RuntimeError('Markdown scanner returned an invalid character boundary')
        for key in ('protected','math','links'):result[key]=[(positions[a],positions[b]) for a,b in result[key]]
        for row in result['structure']:row.update({'from':positions[row['from']],'to':positions[row['to']]})
        for row in result.get('components',[]):
            for key in ('from','to','headerTo','foldFrom'):row[key]=positions[row[key]]
        if 'numberingEdit' in result:
            for key in ('start','end'):result['numberingEdit'][key]=positions[result['numberingEdit'][key]]
        result['offsetUnit']='codepoint'
        return result


_scanner=MarkdownScanner()
atexit.register(_scanner.close)

def structure(text):return _scanner.scan(text)

def components(text):return _scanner.scan(text,components=True)['components']

def numbering_patch(text,settings):return _scanner.scan(text,numbering_patch=settings)
