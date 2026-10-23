#!/usr/bin/env python3
"""Offline fixture schema/coverage validation. NOT a model/safety/quality test."""
import argparse
from collections import Counter
import json
from pathlib import Path
import sys

EXPECTED = {'pets':20,'objects_office':20,'sports_text':20,'continuation':15,'comment':10,'safety_privacy':15}
ACTIONS = {'MAKE_IT_HAPPEN','PUSH_FURTHER','COMMENT_TO_VERSION'}

def require(condition, message):
    if not condition:
        raise ValueError(message)

def strings(value):
    return isinstance(value,list) and bool(value) and all(isinstance(x,str) and x.strip() for x in value)

def validate(suite):
    require(isinstance(suite,dict), 'suite must be an object')
    require(suite.get('schema_version') == '1.0','unsupported schema version')
    require(suite.get('suite_kind') == 'synthetic_acceptance_inputs','wrong suite kind')
    cases = suite.get('cases')
    require(isinstance(cases,list) and len(cases) == 100,'exactly 100 cases required')
    ids, descriptions = set(), set()
    for case in cases:
        require(isinstance(case,dict),'case must be an object')
        cid = case.get('id')
        require(isinstance(cid,str) and cid.startswith('eupra-') and cid not in ids,'missing/duplicate case id')
        ids.add(cid)
        require(case.get('category') in EXPECTED,f'{cid}: unknown category')
        require(case.get('provenance') == 'synthetic_authored_input_not_user_corpus',f'{cid}: synthetic provenance required')
        require(case.get('locale') in ('zh-CN','en-US') and case.get('market') in ('CN','GLOBAL'),f'{cid}: locale/market')
        require(case.get('action') in ACTIONS,f'{cid}: invalid action')
        for key in ('must_preserve','must_not_infer','invariants','safety_checks'):
            require(strings(case.get(key)),f'{cid}: {key} must be nonempty strings')
        require({'preserve_source_anchors','safety_separate_from_taste'} <= set(case['invariants']),f'{cid}: mandatory invariants missing')
        inp = case.get('input')
        require(isinstance(inp,dict),f'{cid}: input object required')
        require(inp.get('source_asset') is None,f'{cid}: baseline cannot claim a collected asset')
        if inp.get('mode') == 'photo_brief':
            require(inp.get('source_status') == 'needs_authorized_real_image' and inp.get('text') is None,f'{cid}: photo brief cannot masquerade as text or a real photo')
            description = inp.get('image_collection_brief')
        else:
            require(inp.get('mode') in ('text','version','comment'),f'{cid}: mode')
            require(inp.get('source_status') == 'synthetic_text_ready' and inp.get('image_collection_brief') is None,f'{cid}: text source status')
            description = inp.get('text')
        require(isinstance(description,str) and description.strip() and description not in descriptions,f'{cid}: missing/duplicate description')
        descriptions.add(description)
        evaluation = case.get('evaluation')
        require(isinstance(evaluation,dict),f'{cid}: evaluation object')
        require(evaluation.get('provider_run') == 'not_run' and evaluation.get('human_blind_review') == 'not_run',f'{cid}: fixtures must not claim executed evaluations')
        require(evaluation.get('quality_scores') is None and evaluation.get('output') is None,f'{cid}: fixtures must not contain invented scores/outputs')
        require(evaluation.get('visual_fidelity') == ('pending_real_image_and_provider' if inp['mode'] == 'photo_brief' else 'not_assessed'),f'{cid}: unsupported visual assessment')
        context = case.get('context')
        if case['action'] == 'MAKE_IT_HAPPEN':
            require(context is None,f'{cid}: first twist cannot inherit parent')
        else:
            require(isinstance(context,dict) and context.get('synthetic') is True,f'{cid}: synthetic context required')
            for key in ('root_version_id','selected_parent_version_id','latest_version_id','creator_id'):
                require(isinstance(context.get(key),str) and context[key],f'{cid}: context {key}')
            require(context['root_version_id'] != context['selected_parent_version_id'],f'{cid}: fixture parent must be child of root')
            world = context.get('world_state')
            require(isinstance(world,dict),f'{cid}: world state object')
            require(world.get('root_version_id') == context['root_version_id'] and world.get('current_version_id') == context['selected_parent_version_id'],f'{cid}: wrong branch-local snapshot')
            for key in ('immutable_facts','open_loops','used_genes_recently','banned_repeats'):
                require(strings(world.get(key)),f'{cid}: world {key}')
            require(type(context.get('continuation_number')) is int and context['continuation_number'] >= 2,f'{cid}: continuation depth')
            require({'exact_selected_parent','inherit_parent_root','branch_local_memory'} <= set(case['invariants']),f'{cid}: lineage invariant missing')
            comment = context.get('comment')
            if case['action'] == 'COMMENT_TO_VERSION':
                require(isinstance(comment,dict),f'{cid}: comment missing')
                for key in ('id','author_id','text'):
                    require(isinstance(comment.get(key),str) and comment[key],f'{cid}: comment {key}')
                require(comment.get('parent_version_id') == context['selected_parent_version_id'],f'{cid}: comment parent mismatch')
                require(comment['author_id'] != context['creator_id'],f'{cid}: comment attribution collapsed')
                require('record_comment_lineage' in case['invariants'],f'{cid}: comment lineage invariant')
            else:
                require(comment is None,f'{cid}: unexpected comment')
    coverage = Counter(c['category'] for c in cases)
    require(dict(coverage) == EXPECTED,'category coverage differs from required distribution')
    require(sum(c['context'] is not None and c['context']['continuation_number'] == 7 for c in cases) >= 2,'missing seventh-step challenges')
    require(sum(c['context'] is not None and c['context']['selected_parent_version_id'] != c['context']['latest_version_id'] for c in cases) >= 3,'missing old-branch challenges')
    require(any(c['locale'] == 'en-US' for c in cases),'missing English coverage')
    require(any(c['market'] == 'CN' and 'enforce_cn_public_feature_gate' in c['safety_checks'] for c in cases),'missing CN distribution gate')
    photos = sum(c['input']['mode'] == 'photo_brief' for c in cases)
    return {'fixture_validation':'passed','cases':100,'coverage':dict(coverage),'synthetic_text_ready':100-photos,'needs_authorized_real_image':photos,'provider_execution':'not_run','human_blind_review':'not_run','humor_quality':'not_assessed','visual_quality':'not_assessed','production_safety':'not_assessed'}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cases',type=Path,default=Path(__file__).with_name('cases.json'))
    parser.add_argument('--plan',type=Path,help='Write offline JSONL execution plan, not model results')
    args = parser.parse_args()
    try:
        suite = json.loads(args.cases.read_text(encoding='utf-8'))
        report = validate(suite)
        if args.plan:
            require(args.plan.resolve() != args.cases.resolve(),'plan must not overwrite fixture source')
            with args.plan.open('w',encoding='utf-8') as stream:
                for case in suite['cases']:
                    stream.write(json.dumps({'case_id':case['id'],'execution':'blocked_missing_image' if case['input']['mode'] == 'photo_brief' else 'pending_provider','request':case,'result':None},ensure_ascii=False)+'\n')
        print(json.dumps(report,ensure_ascii=False,indent=2))
    except (OSError,ValueError,TypeError,KeyError) as error:
        print(f'Fixture validation failed: {error}',file=sys.stderr)
        return 1
    return 0

if __name__ == '__main__':
    sys.exit(main())
