"""Shell access to the shared index. No Obsidian process is required."""
import argparse,json,secrets,sys
from pathlib import Path

def main(argv=None):
    ap=argparse.ArgumentParser(description=__doc__,formatter_class=argparse.RawDescriptionHelpFormatter,epilog='''Examples (prefix with --root STORE --vault VAULT --test for the lab):
  search 'chain #calculus t:theorem' --limit 5 --json
  search '$f^{\\prime}\\left(x\\right)$' --book Larson
  batch '["#calculus", "$x^2$"]' --json
  resolve 'thm 5.2' --note 'Books/Larson/Chapter 5.md' --json
  outline --note 'Books/Larson/Chapter 5.md' --json
  get UUID
  justify UUID --note 'Chapter 6.md' --line 24 --column 12 --dry-run
  apply PLAN_TOKEN
  undo PLAN_TOKEN
Columns are zero-based Unicode characters; lines are one-based. Write commands
prepare durable dry-run plans. Apply refuses changed sources/targets and hands open-vault writes to the editor. Retrying apply is idempotent. No ID or link markup is hand-written.''')
    ap.add_argument('--root',type=Path);ap.add_argument('--vault',required=True);ap.add_argument('--test',action='store_true')
    ap.add_argument('operation',choices=['search','batch','get','resolve','outline','insert-copy','insert-link','insert-linked-title','justify','apply','undo','catalog','detail','history','locate','preview','sync','status'])
    ap.add_argument('value',nargs='?',default='');ap.add_argument('--json',action='store_true');ap.add_argument('--note');ap.add_argument('--book');ap.add_argument('--chapter');ap.add_argument('--vault-filter',action='append');ap.add_argument('--limit',type=int,default=10);ap.add_argument('--offset',type=int,default=0);ap.add_argument('--line',type=int);ap.add_argument('--column',type=int,default=0);ap.add_argument('--end-column',type=int);ap.add_argument('--mode',choices=['n','t','b'],default='n');ap.add_argument('--dry-run',action='store_true')
    args=ap.parse_args(argv)
    if args.operation in ('search','batch','get','resolve','outline'):
        from cli_query_worker import call
        result=call(vars(args))
    else:result=execute(args)
    op=args.operation
    if args.json:print(json.dumps(result,ensure_ascii=False,separators=(',',':')))
    elif op=='get':print(result['body'])
    elif 'diff' in result:print(result['diff']);print('Apply token: '+result['token'])
    elif op in ('search','batch'):
        for q in result.get('queries',[result]):
            for group in q['groups']:
                print('Query: '+group['term'])
                for r in group['rows']:print(f"{r['id']} | {r['label']} | {r['statement']} | {r['source']['vault']}/{r['source']['note']}:{r['source']['line']} | "+' '.join('#'+t for t in r['tags']))
                if group['more']:print('More: --offset '+str(group['offset']+args.limit))
    else:print(json.dumps(result,ensure_ascii=False,indent=2))

def execute(args,service=None):
    from reviewed_service import ReviewedService
    from deploy import DEFAULT_LIBRARY
    from agent_api import AgentAPI
    service=service or ReviewedService(args.root or DEFAULT_LIBRARY,args.vault,secrets.token_urlsafe(32),production=not args.test);api=AgentAPI(service);op=args.operation
    if op=='search':result=api.search(args.value,args.limit,args.offset,args.book,args.chapter,args.vault_filter)
    elif op=='batch':
        queries=json.loads(args.value)
        if not isinstance(queries,list) or not 1<=len(queries)<=8 or any(not isinstance(q,str) for q in queries):raise ValueError('Batch requires 1–8 query strings')
        result={'queries':[{'query':q,**api.search(q,args.limit,args.offset,args.book,args.chapter,args.vault_filter)} for q in queries]}
    elif op=='get':result=api.get(args.value)
    elif op=='outline':
        if not args.note:raise ValueError('Outline requires --note')
        result=api.outline(args.note)
    elif op=='resolve':result=api.resolve(args.value,args.note,args.book)
    elif op=='apply':result=api.wait_online(api.apply(args.value))
    elif op=='undo':result=api.wait_online(api.undo(args.value))
    elif op in ('insert-copy','insert-link','insert-linked-title','justify'):
        if not args.note or not args.line:raise ValueError('Insertion requires --note and --line')
        result=api.plan(op,args.note,args.value,args.line,args.column,args.end_column,args.mode)
    else:
        req={**service.live.metadata(),'op':op}
        if op=='detail':req['id']=args.value
        elif op in ('history','locate'):req.update(op='live-'+op,id=args.value)
        elif op in ('preview','sync'):
            req.update(op='live-'+op,path=args.value)
            if op=='preview':
                from live_library import source_hash
                req['sourceHash']=source_hash(service.live.read(args.value))
        elif op=='status':req['op']='live-status'
        result=service.handle(req)['data']
    return result

if __name__=='__main__':
    try:main()
    except (ValueError,OSError,KeyError) as e:print('Error: '+str(e),file=sys.stderr);sys.exit(2)
