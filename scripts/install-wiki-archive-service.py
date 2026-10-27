"""Install the consent-gated Wiki archive worker and offline midnight check."""
import argparse
import json
import os
from pathlib import Path
import plistlib
import shlex
import shutil
import subprocess
import sys

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    if sys.platform != 'darwin':
        raise SystemExit('This installer requires macOS.')
    project = Path(__file__).resolve().parent.parent
    home = Path.home() / 'Library/Application Support/WarframeWikiArchive'
    label = 'local.warframe.wiki-image-archive'
    daily_label = label + '.daily'
    agents = Path.home() / 'Library/LaunchAgents'
    node = Path('/usr/local/bin/node')
    config = {'label': label, 'dailyLabel': daily_label, 'home': str(home),
              'projectRoot': str(project), 'timezone': 'Asia/Shanghai',
              'consentFile': str(home / 'site-consent.json'),
              'sourceConsentFile': str(project / '.cache/wiki-images/site-consent.json')}
    if args.dry_run:
        print(json.dumps(config, ensure_ascii=False, indent=2))
        return
    if (home / 'service.json').exists() or (agents / (label + '.plist')).exists():
        raise SystemExit('Service already installed; refusing to create or reset a duplicate.')
    subprocess.run([str(node), '--version'], check=True)
    for folder in ['scripts', 'src/core', 'node_modules', 'logs', 'daily']:
        (home / folder).mkdir(parents=True, exist_ok=True)
    for relative in ['scripts/archive-wiki-images.mjs', 'scripts/run-wiki-archive-service.mjs', 'src/core/io.mjs']:
        shutil.copy2(project / relative, home / relative)
    shutil.copytree(project / 'node_modules/undici', home / 'node_modules/undici', dirs_exist_ok=True)
    (home / 'package.json').write_text(json.dumps({'private': True, 'type': 'module'}))
    (home / 'service.json').write_text(json.dumps(config, ensure_ascii=False, indent=2) + '\n')
    os.chmod(home / 'service.json', 0o600)
    # Copy only actual existing evidence. Never generate an approved permit.
    source_consent = Path(config['sourceConsentFile'])
    if source_consent.is_file():
        shutil.copy2(source_consent, config['consentFile'])
        os.chmod(config['consentFile'], 0o600)
    env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'TZ': 'Asia/Shanghai'}
    for key in ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy']:
        if key in os.environ:
            env[key] = os.environ[key]
    common = {'WorkingDirectory': str(home), 'ExitTimeOut': 75, 'EnvironmentVariables': env}
    runner = str(home / 'scripts/run-wiki-archive-service.mjs')
    jobs = [dict(common, Label=label, ProgramArguments=[str(node), runner], RunAtLoad=True,
                 KeepAlive={'SuccessfulExit': False}, ThrottleInterval=300,
                 StandardOutPath=str(home / 'logs/worker.log'), StandardErrorPath=str(home / 'logs/worker-error.log')),
            dict(common, Label=daily_label, ProgramArguments=[str(node), runner, '--check'],
                 StartCalendarInterval={'Hour': 0, 'Minute': 0},
                 StandardOutPath=str(home / 'logs/daily.log'), StandardErrorPath=str(home / 'logs/daily-error.log'))]
    agents.mkdir(parents=True, exist_ok=True)
    plists = []
    for job in jobs:
        plist = agents / (job['Label'] + '.plist')
        with plist.open('wb') as handle:
            plistlib.dump(job, handle)
        os.chmod(plist, 0o600)
        plists.append(plist)
    for name, option in [('查看Wiki获取状态.command', '--status'), ('立即检查Wiki状态.command', '--check')]:
        command = home / name
        command.write_text('#!/bin/zsh\n' + shlex.quote(str(node)) + ' ' + shlex.quote(runner) + ' ' + option + '\n')
        command.chmod(0o700)
    command = home / '停止Wiki后台任务.command'
    command.write_text('#!/bin/zsh\nset -e\n' + shlex.quote(str(node)) + ' ' + shlex.quote(runner) + ' --stop\n'
                       + '\n'.join('/bin/launchctl bootout gui/$(/usr/bin/id -u)/' + item + ' 2>/dev/null || true' for item in [label, daily_label])
                       + '\n' + '\n'.join('/bin/rm -f ' + shlex.quote(str(p)) for p in plists) + '\n')
    command.chmod(0o700)
    for plist in plists:
        subprocess.run(['/bin/launchctl', 'bootstrap', f'gui/{os.getuid()}', str(plist)], check=True)
    subprocess.run([str(node), runner, '--check'], check=True)
    print(json.dumps(config, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
