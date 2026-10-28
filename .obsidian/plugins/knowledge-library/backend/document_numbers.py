"""Resolve a document's labels from ordered occurrences, never library order.

No source writes. Authored numbers stay pinned unless explicitly overridden.
The editor and AI adapters consume the same result and ambiguity diagnostics.
"""
from collections import Counter, defaultdict
import re
import string
from callout_labels import parse_label,ALIASES

BLOCK_ID=re.compile(r'[A-Za-z0-9-]{1,80}\Z')


def ordinal(value,style):
    if not isinstance(value,int) or isinstance(value,bool) or value<1:raise ValueError('Counter must be a positive integer')
    if style=='decimal':return str(value)
    if style in ('alpha','ALPHA'):
        result=''
        while value:value,remainder=divmod(value-1,26);result=chr(97+remainder)+result
        return result.upper() if style=='ALPHA' else result
    if style in ('roman','ROMAN'):
        if value>3999:raise ValueError('Roman numbering supports 1 through 3999')
        result=''
        for number,letters in [(1000,'M'),(900,'CM'),(500,'D'),(400,'CD'),(100,'C'),(90,'XC'),(50,'L'),(40,'XL'),(10,'X'),(9,'IX'),(5,'V'),(4,'IV'),(1,'I')]:
            count,value=divmod(value,number);result+=letters*count
        return result if style=='ROMAN' else result.lower()
    raise ValueError('Unsupported numbering style')


def format_number(template,values):
    if not isinstance(template,str) or len(template)>120:raise ValueError('Invalid numbering format')
    # The prefix preset is useful in notes without a chapter as well. Only
    # this optional chapter segment is elided; other missing fields are errors.
    if '{prefix}' in template and values.get('chapter') in (None,''):template=template.replace('{chapter}.','')
    result=[]
    for literal,key,spec,conversion in string.Formatter().parse(template):
        result.append(literal)
        if key is None:continue
        if key not in ('n','chapter','section','type','prefix','series') or spec or conversion:raise ValueError('Numbering accepts {n}, {chapter}, {section}, {type}, {prefix}, and {series}')
        if values.get(key) in (None,''):raise ValueError('Missing '+key+' for numbering')
        result.append(str(values[key]))
    return ''.join(result)


def resolve_document(document_id,occurrences,config=None):
    config=config or {};source_titles=config.get('titleMode')=='source';policies=config.get('types',{});results={};diagnostics=[];displays=[]
    counts=Counter(o.get('blockId') for o in occurrences if o.get('blockId'))
    counters={};counter_rules={};labels=defaultdict(list);regions=set()
    def source_kind(o):return o.get('sourceStyle',o['kind']).lower()
    def semantic_kind(o):return ALIASES.get(source_kind(o),source_kind(o))
    def occurrence_policy(o):
        rule={**policies.get(source_kind(o),policies.get(semantic_kind(o),{})),**o.get('numbering',{})}
        counter=rule.get('counter','')
        if counter.startswith('authored:'):
            _,kind,prefix=counter.split(':',2)
            authored=[parse_label(row['kind'],row.get('title','')) for row in occurrences if semantic_kind(row)==kind]
            used=[int(label['number'][len(prefix)+1:]) for label in authored if label['number'] and re.fullmatch(re.escape(prefix)+r'\.\d+',label['number'])]
            rule={**rule,'format':prefix+'.{n}','start':max(used,default=0)+1,'reset':'document'}
        if counter.startswith('user:'):
            defaults={'series':counter.split(':',2)[-1],'prefix':'A','format':'{type} {chapter}.{prefix}{n}'}
            rule={**rule,**defaults,**config.get('series',{}).get(counter,{})}
        return rule
    def counter_key(o,policy,required=True):
        group=policy.get('counter',source_kind(o));reset=policy.get('reset','document')
        if reset not in ('document','chapter','section'):raise ValueError('Invalid counter reset scope')
        scope='' if reset=='document' else o.get(reset,config.get(reset))
        if scope in (None,'') and reset!='document':
            if not required:return None
            raise ValueError('Missing '+reset+' for counter reset')
        return group,str(scope)
    authored_groups=set()
    for o in occurrences:
        parsed=parse_label(o['kind'],o.get('title',''))
        if parsed['number']:
            policy=occurrence_policy(o)
            # Aliases share the conservative authored-book guard, not an
            # automatic counter. Vocabulary remains visibly Vocabulary.
            authored_groups.add(policy.get('counter',semantic_kind(o)))
    def issue(o,reason,code='invalid-label'):diagnostics.append({'blockId':o.get('blockId'),'line':o.get('line'),'reason':reason,'code':code})
    for o in occurrences:
        block=o.get('blockId')
        valid_identity=isinstance(block,str) and bool(BLOCK_ID.fullmatch(block)) and counts[block]==1
        if block and not valid_identity:issue(o,'Duplicate or invalid block identity','duplicate-anchor' if counts[block]>1 else 'invalid-anchor')
        parsed=parse_label(o['kind'],o.get('title',''));kind=semantic_kind(o) if o.get('component') else parsed['kind']
        policy=occurrence_policy(o);legacy=o.get('legacyOverride') or {}
        preserve_legacy=config.get('authoredGroups','number')=='number' and 'mode' not in policy
        legacy_counter=config.get('authoredGroups','number')=='number' and policy.get('counter',source_kind(o))==source_kind(o) and policy.get('reset','document')=='document'
        mode=policy.get('mode','fixed' if parsed['number'] else 'off' if source_titles or semantic_kind(o)=='figure' or not preserve_legacy and policy.get('counter',semantic_kind(o)) in authored_groups else 'auto')
        if parsed['number'] and not policy.get('overrideAuthored',False):mode='fixed'
        unresolved=parsed['issue'] if 'mode' not in policy else None
        title=o.get('nameText',parsed['nameText']);number=None;pinned=False
        keep_title=source_titles and not policy.get('overrideAuthored') and mode!='auto'
        display={'kind':kind,'sourceKind':source_kind(o),'displayType':policy.get('typeLabel',display_type(source_kind(o))),
                 'title':title,'number':None,'numberLabel':'','bothLabel':title,'pinned':False,'authoredNumber':parsed['number'],'authoredPrefix':parsed['prefixText'],'authoredLabel':parsed['label'],'overrideAuthored':bool(policy.get('overrideAuthored') or not keep_title and o.get('component') and parsed['kind']!=semantic_kind(o)),'state':'issue'}
        displays.append(display)
        try:
            key=counter_key(o,policy,mode=='auto' or legacy.get('mode')=='start' and not parsed['number'])
            if legacy.get('mode')=='unknown':issue(o,'Unknown callout numbering override: '+legacy.get('raw',''),'unknown-numbering-override')
            elif legacy.get('mode')=='start':
                if parsed['number'] and mode=='fixed' and not legacy_counter:issue(o,'Authored number retained; its legacy restart hint is redundant','override-redundant-with-pin')
                elif semantic_kind(o)=='figure' and policy.get('mode')!='auto':issue(o,'Figure restart ignored until automatic figure numbering is enabled','ignored-numbering-override')
                elif policy.get('mode')=='off':issue(o,'Restart ignored by an explicit unnumbered policy','ignored-numbering-override')
                else:
                    restart=legacy['start'];ordinal(restart,policy.get('style','decimal'))
                    regions.add(key);counters[key]=restart
            if legacy.get('mode')=='manual':mode='fixed' if parsed['number'] else 'off'
            elif 'mode' not in policy and not parsed['number'] and key in regions:mode='auto'
            if mode=='fixed':
                number=parsed['number'] if parsed['number'] and not policy.get('overrideAuthored',False) else policy.get('label',parsed['number']);pinned=True
                if not isinstance(number,str) or not number.strip() or len(number)>80 or any(ord(c)<32 for c in number):raise ValueError('Fixed label must be nonempty printable text')
                # Legacy Outline counted authored callouts too. Keep that
                # position for interleaved automatic members without replacing
                # the authored label displayed on this occurrence.
                if legacy_counter and key is not None and semantic_kind(o)!='figure' and legacy.get('mode')!='manual':
                    counters[key]=counters.get(key,policy.get('start',1))+1
            elif mode=='auto':
                group=key[0]
                start=policy.get('start',1);style=policy.get('style','decimal');ordinal(start,style)
                rule=(start,style)
                if group in counter_rules and counter_rules[group]!=rule:raise ValueError('Conflicting rules for shared counter '+group)
                counter_rules[group]=rule;value=counters.get(key,start)
                number=format_number(policy.get('format','{n}'),{'n':ordinal(value,style),'chapter':o.get('chapter',config.get('chapter')),'section':o.get('section',config.get('section')),'type':display['displayType'],'prefix':policy.get('prefix','A'),'series':policy.get('series')})
                counters[key]=value+1
            elif mode!='off':raise ValueError('Invalid numbering mode')
        except (ValueError,TypeError) as error:issue(o,str(error));display['issue']=str(error);continue
        if unresolved:issue(o,unresolved);display['issue']=unresolved;continue
        type_label=policy.get('typeLabel',display_type(source_kind(o)))
        number_label=(number if mode=='auto' and '{type}' in policy.get('format','') else (type_label+' '+number).strip()) if number is not None else ''
        if mode=='fixed' and parsed['number']==number and parsed['label'] and (keep_title or not o.get('component') or parsed['kind']==semantic_kind(o)) and (not policy.get('overrideAuthored',False) or 'typeLabel' not in policy):number_label=parsed['label']
        both_label=number_label+(': '+title if title else '') if number_label else title
        if number_label and title and config.get('bothFormat'):
            try:
                pieces=[]
                for literal,key,spec,conversion in string.Formatter().parse(config['bothFormat']):
                    pieces.append(literal)
                    if key is not None:
                        if key not in ('label','title') or spec or conversion:raise ValueError('Both format accepts only {label} and {title}')
                        pieces.append({'label':number_label,'title':title}[key])
                both_label=''.join(pieces)
            except ValueError as error:issue(o,str(error));continue
        if keep_title:
            if parsed['number'] and number==parsed['number']:number_label=parsed['prefixText']
            both_label=o.get('title','') or display['displayType']
            display['sourceTitle']=both_label
        display.update(number=number,numberLabel=number_label,bothLabel=both_label,pinned=pinned,
                       state='pinned' if pinned else 'auto' if mode=='auto' else 'manual' if legacy.get('mode')=='manual' else 'unnumbered')
        if mode=='off':display['reason']='manual-override' if legacy.get('mode')=='manual' else 'policy-off' if policy.get('mode')=='off' else 'figure-default' if semantic_kind(o)=='figure' else 'authored-group'
        # Distinct visible names (Vocabulary vs Definition) are not duplicates.
        # Conventional abbreviations Fig./Figure remain equivalent.
        duplicate_label=re.sub(r'^(fig|eq|def)\.?\s+',lambda m:ALIASES[m[1].lower()]+' ',number_label,flags=re.I).casefold()
        if number is not None:labels[duplicate_label].append((o,number_label,display))
        if not valid_identity:continue  # Unlinked callouts still advance their counters.
        results[block]={'documentId':document_id,'blockId':block,'kind':kind,'title':title,
                        'number':number,'numberLabel':number_label,'bothLabel':both_label,'pinned':pinned}
        if o.get('entityId'):results[block].update(entityId=o['entityId'],occurrenceKey=o.get('occurrenceKey'))
    for grouped in labels.values():
        if len(grouped)>1:
            for occurrence,label,display in grouped:
                reason='Duplicate displayed label: '+label
                block=occurrence.get('blockId')
                if block in results:results[block].update(warning=reason,warningCode='duplicate-label')
                display.update(warning=reason,warningCode='duplicate-label')
                issue(occurrence,reason,'duplicate-label')
    return {'documentId':document_id,'targets':results,'displays':displays,'diagnostics':diagnostics}


def display_type(kind):
    words=re.split(r'[-_\s]+',kind.lower())
    return ' '.join(word.upper() if word.isascii() and word.isalpha() and len(word)<=3 else word.capitalize() for word in words if word) or 'Callout'
