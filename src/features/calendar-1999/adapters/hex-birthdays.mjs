import { dateToOrdinal } from '../domain/calendar.mjs';

// Verified birthdays of the six Hex members (CAL-11, #37). The world-state adapter recognises birthdays with this table;
// 文档/深入/51-1999日历六人组生日与角色图.md says how to check a date, add a source, change a profile or replace a picture.
//
// - id is the stable character ID. It never changes when a name, a picture or a source changes, and it is never a
//   display name. portraitKey is the picture resource key the host maps to a file; it is apart from every reward ID.
// - month and day are the in-game birthday. ordinal is derived from them by the domain's 1999 annual-day rule, never
//   written by hand, so the table cannot drift from the calendar grid.
// - dialogues are the exact KIM chat room files that name this character in an upstream CET_PLOT event. They are
//   matched as written, never by a part of a name: Amir's chat room is JabirDialogue_rom.dialogue, so a guess from
//   "Amir" would miss him. The group chat HexDialogue_rom.dialogue names no one and is in no record.
// - role and personality are short profile lines written for the calendar, in our own words, from the character's
//   dossier on the wiki page in sources; the protoframe name is the official one, which dict.zh keeps in English.
// - gifts are the Hex Treasure themed after the character: a full item ID of the official export, its dict.zh name, and
//   a note on why it suits the character. In game a Hex Treasure is traded with Lettie for Hex standing, and a birthday
//   is greeted by chatting in KIM; the calendar only names the suitable item and records no gift and no progress.
// - sources say where each part was checked. For the birthday the authority is the in-game KIM profile or the in-game
//   calendar; each source names the transcription that was read, and the date it was read.
// - name is the Simplified Chinese name the App writes (dict.zh of the official export), with its key in nameSource.

const WIKI = 'https://wiki.warframe.com/w/';
const KIM = `${WIKI}KIM`;
const CALENDAR = `${WIKI}Calendar`;
const TREASURES = `${WIKI}Hex_Treasure`;
const CHAT_ROOMS = '世界状态上游/git/browse.wf/kim-convo-locator.php';
const EXPORT = '世界状态上游/git/warframe-public-export-plus/ExportResources.json';
const CHECKED = '2026-11-06';
const TREASURE = name => `/Lotus/Types/Gameplay/1999Wf/Resources/HexDogTag${name}`;

const frozen = value => Object.freeze(value);
const record = ({ id, name, englishName, month, day, dialogues, kim, calendar, nameKey, page, role, personality, gift }) => {
  const ordinal = dateToOrdinal(month, day);
  if (ordinal === null) throw new RangeError(`Birthday of ${id} is not a 1999 date: ${month}/${day}`);
  return frozen({
    id, name, englishName, month, day, ordinal, portraitKey: id,
    dialogues: frozen([...dialogues]),
    role, personality,
    gifts: frozen([frozen({ id: TREASURE(englishName), name: gift.name, note: gift.note })]),
    sources: frozen([
      frozen({ kind: 'kim-profile', ref: KIM, quote: kim, checkedAt: CHECKED }),
      frozen({ kind: 'calendar', ref: CALENDAR, quote: calendar, checkedAt: CHECKED }),
      frozen({ kind: 'chat-room', ref: CHAT_ROOMS, quote: dialogues.join(', '), checkedAt: CHECKED }),
      frozen({ kind: 'character-page', ref: WIKI + page, quote: 'role and personality from the dossier', checkedAt: CHECKED }),
      frozen({ kind: 'hex-treasure', ref: `${TREASURES} · ${EXPORT}`, quote: `${TREASURE(englishName)} · dict.zh /Lotus/Language/1999/HexDogTag${englishName}Name`, checkedAt: CHECKED })
    ]),
    nameSource: `dict.zh ${nameKey}`
  });
};

export const HEX_BIRTHDAYS = frozen([
  record({ id: 'hex-lettie', name: '莱蒂', englishName: 'Lettie', month: 2, day: 14, dialogues: ['LettieDialogue_rom.dialogue'],
    kim: 'Belladona ~{@ / Lettie / February 14', calendar: 'Leticia: February 14th (Winter)', nameKey: '/Lotus/Language/ShipDecorations/PlushyLettieName',
    page: 'Lettie', role: '医疗兵兼策略担当，也负责收下六人组宝物（Trinity 原型战甲）',
    personality: '冷静务实到近乎多疑，忙碌又受不了浪费时间；不轻易信任人、说话带刺，却很疼爱她养的老鼠。',
    gift: { name: '切达芝士皇冠麦片', note: '她养的老鼠最爱的零食。' } }),
  record({ id: 'hex-amir', name: '阿米尔', englishName: 'Amir', month: 5, day: 23, dialogues: ['JabirDialogue_rom.dialogue'],
    kim: 'H16h V0l7463 / Amir / May 23', calendar: 'Amir: May 23rd (Spring)', nameKey: '/Lotus/Language/ShipDecorations/PlushyAmirName',
    page: 'Amir', role: '技术员与电子专家（Volt 原型战甲）',
    personality: '冲动、善变、难以预料；打字飞快、心思跳跃，热爱科技与游戏，好胜又怕被取笑，压力大时容易焦虑。',
    gift: { name: '女伯爵漫画', note: '他爱看漫画，心爱的街机游戏里也有这位女伯爵。' } }),
  record({ id: 'hex-aoi', name: '碧', englishName: 'Aoi', month: 7, day: 10, dialogues: ['AoiDialogue_rom.dialogue'],
    kim: 'xX GLIMMER Xx / Aoi / July 10', calendar: 'Aoi: July 10th (Summer)', nameKey: '/Lotus/Language/ShipDecorations/PlushyAoiName',
    page: 'Aoi', role: '副队长兼机械师，负责控场（Mag 原型战甲）',
    personality: '队伍里的温暖核心，对在乎的人保护欲强、个性强悍；平常友善好相处，谈到正事就认真，不喜欢拿别人开玩笑。',
    gift: { name: '线上时代 CD', note: '她是男团「线上时代」的乐迷。' } }),
  record({ id: 'hex-eleanor', name: '埃莉诺', englishName: 'Eleanor', month: 11, day: 2, dialogues: ['EleanorDialogue_rom.dialogue'],
    kim: 'Salem / Eleanor / November 2', calendar: 'Eleanor: November 2nd (Autumn)', nameKey: '/Lotus/Language/ShipDecorations/PlushyEleanorName',
    page: 'Eleanor', role: '心灵作战员，负责隐秘通讯与牵制（Nyx 原型战甲）',
    personality: '气场慑人，护家心切，对记者工作怀抱理想；外向爱闹，内心却害怕被当成怪物。',
    gift: { name: '心情水晶', note: '她偏爱心情水晶，常用来让自己静下来。' } }),
  record({ id: 'hex-arthur', name: '亚瑟', englishName: 'Arthur', month: 11, day: 3, dialogues: ['ArthurDialogue_rom.dialogue'],
    kim: 'Broadsword / Arthur / November 3', calendar: 'Arthur: November 3rd (Autumn)', nameKey: '/Lotus/Language/ShipDecorations/PlushyArthurName',
    page: 'Arthur', role: '队长兼作战协调（Excalibur 原型战甲）',
    personality: '纪律严明、受过专业训练，起初严肃又疏离；把六人组放在心上，却总放不下重担，喜欢小酌和下厨。',
    gift: { name: '酌趣六瓶装啤酒', note: '队友常拿他爱喝酒开玩笑，正适合让扛着重担的队长喘口气。' } }),
  record({ id: 'hex-quincy', name: '昆西', englishName: 'Quincy', month: 12, day: 4, dialogues: ['QuincyDialogue_rom.dialogue'],
    kim: 'Soldja1Shot1kil / Quincy / December 4', calendar: 'Quincy: December 4th (Autumn)', nameKey: '/Lotus/Language/ShipDecorations/PlushyQuincyName',
    page: 'Quincy', role: '狙击手兼远程火力支援，也是枪匠（Cyte-09 原型战甲）',
    personality: '自信张扬，常拿自己的枪法打赌；外向爱调情，凡事讲求两不相欠，独立又带点愤世嫉俗。',
    gift: { name: '35 毫米胶片', note: '摄影是他的嗜好，胶片永远不嫌多。' } })
]);
