"""Generate a complete auditable enemy association list and keep the README in sync."""
import collections
import csv
import json
import re


def cell(value):
    return str(value).replace('|', '\\|').replace('\n', ' ')


def write_enemy_report(rows, manifest, staging, root):
    rows = sorted(rows, key=lambda row: (row['name'].casefold(), row['id']))
    stats = manifest['enemyImages']
    (staging / 'enemy-image-report.json').write_text(json.dumps({'commit': manifest['commit'], 'summary': stats, 'items': rows},
                                                             ensure_ascii=False, indent=2), encoding='utf-8')
    with (staging / 'enemy-images.csv').open('w', encoding='utf-8-sig', newline='') as output:
        writer = csv.writer(output)
        writer.writerow(['英文名称', '内部标识', '原始 imageName', '实际文件', '图片类型', '匹配方式', '来源条目', '说明'])
        for row in rows:
            writer.writerow([row['name'], row['id'], row['originalImageName'], row['file'], row['kind'], row['method'], row['sourceLabel'], row['note']])
    groups = collections.defaultdict(list)
    for row in rows:
        if row['file']:
            groups[(row['name'], row['file'], row['sourceLabel'], row['method'])].append(row)
    lines = ['<!-- ENEMY-IMAGES:START -->', '## 敌人图片修复与例外（随数据构建更新）', '',
             f"数据提交：`{manifest['commit']}`。图片严格来自这一份 WFCD/warframe-items 快照。", '',
             f"共 **{stats['total']} 条敌人记录**：独立原图 **{stats['original']}** 条、明确标注的角色参考图 **{stats['reference']}** 条、**{stats['missing']}** 条暂无可确认图片。", '',
             '**仅靠当前仓库无法覆盖大部分敌人。** 修复后的参考图来自同角色的幽魂外观、浮印头像或战甲外观，',
             '界面统一标注「参考图」，详情列出来源；它们不能冒充该敌人条目的独立原图。',
             '同名纹章、资源、守护、徽章、摆件及其他角色图片不会被自动当作敌人图。', '',
             '原字段（例如 `alad-v.png`）保留不变，实际文件另存于 `resolvedImageName`；',
             '按敌人 `uniqueName` 应用经核对的例外表，源文件或来源条目改变时构建报错。', '',
             '### 已单独处理的对应关系', '',
             '| 敌人英文名 | 记录数 | 实际 WFCD 图片 | 来源条目 | 处理 |',
             '| --- | ---: | --- | --- | --- |']
    for (name, filename, source, method), entries in sorted(groups.items()):
        lines.append(f'| {cell(name)} | {len(entries)} | `{cell(filename)}` | {cell(source)} | {"参考图，非独立敌人原图" if method == "reviewed-reference" else cell(method)} |')
    lines += ['', '维护表：[assets/enemy-image-overrides.json](assets/enemy-image-overrides.json)。',
              '所有内部变体均按独立 `uniqueName` 记录；基础外观参考不代表变体拥有独立图片。', '',
              '### 已排除的同名错误对应', '',
              '| 敌人英文名 | 被排除的文件 | 仓库中实际所属条目 |', '| --- | --- | --- |']
    # Recompute original filename candidates for references too, to expose superseded false matches.
    from image_resolver import normalize_image
    catalog = json.loads((staging / 'catalog.json').read_text(encoding='utf-8'))['items']
    owners = collections.defaultdict(set)
    for item in catalog:
        if item['category'] != 'Enemy' and item['hasImage']:
            owners[item['imageName']].add(item['name'])
    rejected = set()
    normalized_owners = collections.defaultdict(list)
    for filename, labels in owners.items():
        normalized_owners[normalize_image(filename)].append((filename, labels))
    for row in rows:
        for filename, labels in normalized_owners.get(normalize_image(row['originalImageName']), []):
            if filename != row['file']:
                rejected.add((row['name'], filename, '、'.join(sorted(labels))))
    for name, filename, labels in sorted(rejected):
        lines.append(f'| {cell(name)} | `{cell(filename)}` | {cell(labels)} |')
    missing = collections.defaultdict(list)
    for row in rows:
        if not row['file']:
            missing[(row['name'], row['originalImageName'])].append(row)
    lines += ['', f"### 暂无可靠对应的条目（{stats['missing']} 条，按名称合并列出）", '',
              '下表未使用其他网站的图片，也未用同阵营或近似敌人图片填充。',
              '内部标识与逐条状态另见构建输出 `assets/content/wfcd/enemy-images.csv` 和 `enemy-image-report.json`；',
              '发布包中对应文件位于 `resources/content/`。', '',
              '<details>', '<summary>展开全部未对应名称</summary>', '',
              '| 敌人英文名 | 记录数 | 原始 imageName | 状态 |', '| --- | ---: | --- | --- |']
    for (name, filename), entries in sorted(missing.items()):
        lines.append(f'| {cell(name)} | {len(entries)} | `{cell(filename)}` | WFCD 当前快照无可确认对应图片 |')
    lines += ['', '</details>', '<!-- ENEMY-IMAGES:END -->']
    readme = root / '文档/深入/图片资源敌人关联.md' if (root / '文档').is_dir() else root / 'README.md'
    content = readme.read_text(encoding='utf-8') if readme.exists() else '# 图片资源：敌人关联与参考图\n'
    section = '\n'.join(lines)
    if '<!-- ENEMY-IMAGES:START -->' in content:
        content = re.sub(r'<!-- ENEMY-IMAGES:START -->.*?<!-- ENEMY-IMAGES:END -->', lambda _m: section, content, flags=re.S)
    else:
        content = content.rstrip() + '\n\n' + section + '\n'
    readme.write_text(content, encoding='utf-8')
