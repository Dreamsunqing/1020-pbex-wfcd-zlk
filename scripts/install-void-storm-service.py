"""Migrate the already-started seven-day collector to an independent LaunchAgent."""
import json
import os
from pathlib import Path
import plistlib
import shutil
import shlex
import subprocess

project = Path(__file__).resolve().parent.parent
home = Path.home() / 'Library/Application Support/WarframeVoidStormCollector'
label = 'local.warframe.void-storm-collector'
plist = Path.home() / 'Library/LaunchAgents' / (label + '.plist')
source = project / '.workbench/void-storm-collection'
state = json.loads((source / 'state.json').read_text())
if state['status'] != 'active':
    raise SystemExit('Only an active, already-started collection can be migrated.')
if home.exists() or plist.exists():
    raise SystemExit('Standalone collector already exists; refusing a duplicate installation.')
node = Path('/usr/local/bin/node')
subprocess.run([str(node), '--version'], check=True)
for folder in ['src/core/live-state/raw', 'src/core/live-state', 'scripts', 'node_modules', 'state', 'result', 'logs']:
    (home / folder).mkdir(parents=True, exist_ok=True)
for relative in ['src/core/io.mjs', 'src/core/void-storm-collector.mjs', 'src/core/void-storm-records.mjs', 'src/core/void-storm-standalone-catalog.mjs', 'src/core/live-state/void-storm-mission.mjs', 'src/core/live-state/service.mjs', 'src/core/live-state/raw/extended-json.mjs', 'scripts/run-void-storm-service.mjs']:
    shutil.copy2(project / relative, home / relative)
shutil.copytree(project / 'node_modules/undici', home / 'node_modules/undici')
(home / 'package.json').write_text(json.dumps({'private': True, 'type': 'module'}))
for name in ['catalog.json', 'events.jsonl']:
    shutil.copy2(source / name, home / 'state' / name)
output = home / 'result/九重天七天采集.json'
old_output = Path(state['output'])
shutil.copy2(old_output, output)
state['output'] = str(output)
state['execution'] = {'kind': 'macos-launchagent', 'label': label, 'home': str(home)}
(home / 'state/state.json').write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n')
(home / 'service.json').write_text(json.dumps({'label': label, 'plist': str(plist)}, ensure_ascii=False))
status_command = home / '查看采集状态.command'
status_command.write_text('#!/bin/zsh\n' + shlex.quote(str(node)) + ' ' + shlex.quote(str(home / 'scripts/run-void-storm-service.mjs')) + ' --status\n')
stop_command = home / '停止采集.command'
stop_command.write_text('#!/bin/zsh\nset -e\n/bin/launchctl bootout gui/$(/usr/bin/id -u)/' + label + ' >/dev/null 2>&1 || true\n' + shlex.quote(str(node)) + ' ' + shlex.quote(str(home / 'scripts/run-void-storm-service.mjs')) + ' --stop\n/bin/rm -f ' + shlex.quote(str(plist)) + '\n')
for command in [status_command, stop_command]:
    command.chmod(0o700)

job = {'Label': label, 'ProgramArguments': ['/usr/bin/caffeinate', '-i', '-s', str(node), str(home / 'scripts/run-void-storm-service.mjs')],
       'WorkingDirectory': str(home), 'RunAtLoad': True, 'KeepAlive': {'SuccessfulExit': False}, 'ThrottleInterval': 30,
       'ExitTimeOut': 25, 'StandardOutPath': str(home / 'logs/stdout.log'), 'StandardErrorPath': str(home / 'logs/stderr.log'),
       'EnvironmentVariables': {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HTTP_PROXY': 'http://127.0.0.1:7892', 'HTTPS_PROXY': 'http://127.0.0.1:7892',
                                'http_proxy': 'http://127.0.0.1:7892', 'https_proxy': 'http://127.0.0.1:7892',
                                'NO_PROXY': 'localhost,127.0.0.1,::1,content-zhpt.wf.qq.com', 'no_proxy': 'localhost,127.0.0.1,::1,content-zhpt.wf.qq.com', 'NODE_OPTIONS': '--dns-result-order=ipv4first'}}
plist.parent.mkdir(parents=True, exist_ok=True)
with plist.open('wb') as handle:
    plistlib.dump(job, handle)
os.chmod(plist, 0o600)

# Retire the project scheduler before loading the replacement; never reset the
# clock or permit two roots to independently request the same server.
state['status'] = 'migrated'
state['migratedTo'] = str(home / 'state/state.json')
(source / 'state.json').write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n')
old_output.unlink()
old_output.symlink_to(output)
subprocess.run(['/bin/launchctl', 'bootstrap', f'gui/{os.getuid()}', str(plist)], check=True)
print(json.dumps({'home': str(home), 'label': label, 'plist': str(plist), 'output': str(output), 'startedAt': state['startedAt'], 'endsAt': state['endsAt']}, ensure_ascii=False, indent=2))
