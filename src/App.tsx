import React, { useState, useEffect, useRef } from "react";
import { 
  Beaker, 
  Sparkles, 
  Shield, 
  RotateCcw, 
  Flame, 
  BookOpen, 
  Info, 
  HelpCircle, 
  Skull, 
  Heart, 
  CheckCircle, 
  AlertCircle, 
  Eye, 
  Swords, 
  Play, 
  ListRestart,
  ChevronsRight,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// --- Types ---
type ElementType = "H" | "O" | "C" | "N";

interface DungeonNode {
  id: string;
  depth: number; // 0 to 4
  type: "battle" | "event" | "shop";
  enemyType?: "slime" | "bat" | "ghost";
  isBoss?: boolean;
  completed: boolean;
}

const generateDungeonMap = (): DungeonNode[] => {
  const map: DungeonNode[] = [];
  const enemyPool: ("slime" | "bat" | "ghost")[] = ["slime", "bat", "ghost"];
  
  // 深さ 0: 戦闘
  map.push({
    id: "node-0-0",
    depth: 0,
    type: "battle",
    enemyType: enemyPool[Math.floor(Math.random() * enemyPool.length)],
    completed: false
  });
  
  // 深さ 1: 2ノード
  for (let i = 0; i < 2; i++) {
    const randType = ["battle", "event", "shop"][Math.floor(Math.random() * 3)] as "battle" | "event" | "shop";
    map.push({
      id: `node-1-${i}`,
      depth: 1,
      type: randType,
      enemyType: randType === "battle" ? enemyPool[Math.floor(Math.random() * enemyPool.length)] : undefined,
      completed: false
    });
  }
  
  // 深さ 2: 3ノード
  for (let i = 0; i < 3; i++) {
    const randType = ["battle", "event", "shop"][Math.floor(Math.random() * 3)] as "battle" | "event" | "shop";
    map.push({
      id: `node-2-${i}`,
      depth: 2,
      type: randType,
      enemyType: randType === "battle" ? enemyPool[Math.floor(Math.random() * enemyPool.length)] : undefined,
      completed: false
    });
  }
  
  // 深さ 3: 2ノード
  for (let i = 0; i < 2; i++) {
    const randType = ["battle", "event", "shop"][Math.floor(Math.random() * 3)] as "battle" | "event" | "shop";
    map.push({
      id: `node-3-${i}`,
      depth: 3,
      type: randType,
      enemyType: randType === "battle" ? enemyPool[Math.floor(Math.random() * enemyPool.length)] : undefined,
      completed: false
    });
  }
  
  // 深さ 4: ボス
  map.push({
    id: "node-4-0",
    depth: 4,
    type: "battle",
    enemyType: enemyPool[Math.floor(Math.random() * enemyPool.length)],
    isBoss: true,
    completed: false
  });
  
  return map;
};

const isNodeConnected = (fromId: string | null, toNode: DungeonNode): boolean => {
  if (fromId === null) {
    return toNode.depth === 0;
  }
  
  const fromParts = fromId.split("-");
  const fromDepth = parseInt(fromParts[1], 10);
  const fromIdx = parseInt(fromParts[2], 10);
  
  if (toNode.depth !== fromDepth + 1) {
    return false;
  }
  
  const toIdx = parseInt(toNode.id.split("-")[2], 10);
  
  if (fromDepth === 0) {
    return toIdx === 0 || toIdx === 1;
  }
  if (fromDepth === 1) {
    if (fromIdx === 0) return toIdx === 0 || toIdx === 1;
    if (fromIdx === 1) return toIdx === 1 || toIdx === 2;
  }
  if (fromDepth === 2) {
    if (fromIdx === 0) return toIdx === 0;
    if (fromIdx === 1) return toIdx === 0 || toIdx === 1;
    if (fromIdx === 2) return toIdx === 1;
  }
  if (fromDepth === 3) {
    return toIdx === 0;
  }
  
  return false;
};

interface ElementCard {
  id: string;
  type: ElementType;
  name: string;
  color: string;
  textColor: string;
  bgClass: string;
  borderClass: string;
  glowClass: string;
}

interface BuffDebuff {
  name: "恐怖" | "毒";
  count: number;
  description: string;
}

interface Player {
  hp: number;
  maxHp: number;
  shield: number;
  debuffs: BuffDebuff[];
}

interface Enemy {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  shield: number;
  debuffs: BuffDebuff[];
  traitName: string;
  traitDescription: string;
  behaviorType: "random_equal" | "random_weight" | "fixed";
  behaviors: {
    name: string;
    description: string;
    weight?: number; // for random_weight (e.g. 90, 10)
    action: (player: Player, enemy: Enemy, isFeared: boolean) => { player: Player; enemy: Enemy; log: string };
  }[];
  fixedIndex?: number; // for sequential behaviors
  nextIntent?: string;
  nextIntentDesc?: string;
  imageColor: string;
}

interface CompoundRecipe {
  name: string;
  formula: string;
  formulaDisplay: React.ReactNode;
  elements: { [key in ElementType]?: number };
  description: string;
  testPlayEffect?: string;
  implemented: boolean;
}

// --- Data & Helpers ---

const ELEMENT_DEFS: { [key in ElementType]: { name: string; color: string; textColor: string; bgClass: string; borderClass: string; glowClass: string } } = {
  H: { 
    name: "水素", 
    color: "#38bdf8", 
    textColor: "text-sky-300", 
    bgClass: "bg-sky-950/80", 
    borderClass: "border-sky-500/50",
    glowClass: "shadow-[0_0_15px_rgba(56,189,248,0.3)]"
  },
  O: { 
    name: "酸素", 
    color: "#ef4444", 
    textColor: "text-rose-400", 
    bgClass: "bg-rose-950/80", 
    borderClass: "border-rose-500/50",
    glowClass: "shadow-[0_0_15px_rgba(239,68,68,0.3)]"
  },
  C: { 
    name: "炭素", 
    color: "#94a3b8", 
    textColor: "text-slate-300", 
    bgClass: "bg-slate-900/80", 
    borderClass: "border-slate-500/50",
    glowClass: "shadow-[0_0_15px_rgba(148,163,184,0.3)]"
  },
  N: { 
    name: "窒素", 
    color: "#a855f7", 
    textColor: "text-purple-400", 
    bgClass: "bg-purple-950/80", 
    borderClass: "border-purple-500/50",
    glowClass: "shadow-[0_0_15px_rgba(168,85,247,0.3)]"
  }
};

const RECIPES: CompoundRecipe[] = [
  {
    name: "水",
    formula: "H2O",
    formulaDisplay: (<span>H<sub>2</sub>O</span>),
    elements: { H: 2, O: 1 },
    description: "最も基本的で生命に不可欠な化合物。素早くシールドを張り、微細な攻撃を行う。",
    testPlayEffect: "・敵に3ダメージを与える\n・自身に3のシールドを付与する\n・カードを1枚引く",
    implemented: true
  },
  {
    name: "アンモニア",
    formula: "NH3",
    formulaDisplay: (<span>NH<sub>3</sub></span>),
    elements: { N: 1, H: 3 },
    description: "刺激臭のある気体。他の化合物と組み合わせることで真価を発揮する毒素の触媒。",
    testPlayEffect: "・敵に4ダメージを与える\n・このターンにすでに水（H2O）を合成していたなら、対象に「毒デバフ（カウント+3）」を付与する",
    implemented: true
  },
  {
    name: "一酸化炭素",
    formula: "CO",
    formulaDisplay: (<span>CO</span>),
    elements: { C: 1, O: 1 },
    description: "無色無臭だが極めて有害な気体。相手に静かに浸透し、継続的なダメージを付与する。",
    testPlayEffect: "・敵に「毒デバフ」（カウント1）を付与する\n・カードを1枚引く",
    implemented: true
  },
  {
    name: "二酸化炭素",
    formula: "CO2",
    formulaDisplay: (<span>CO<sub>2</sub></span>),
    elements: { C: 1, O: 2 },
    description: "温暖化を招くガス。窒息性の衝撃と同時に、対象に強力な毒素を流し込む。",
    testPlayEffect: "・敵に4ダメージを与える\n・さらに「毒デバフ」（カウント1）を付与する",
    implemented: true
  },
  {
    name: "一酸化窒素",
    formula: "NO",
    formulaDisplay: (<span>NO</span>),
    elements: { N: 1, O: 1 },
    description: "血管拡張などの生理活性を持つ。危険から身を守るためのシールドを展開する。",
    testPlayEffect: "・自分に2のシールドを付与する\n・さらに墓地から好きなカードを1枚選び手札に加える",
    implemented: true
  },
  {
    name: "二酸化窒素",
    formula: "NO2",
    formulaDisplay: (<span>NO<sub>2</sub></span>),
    elements: { N: 1, O: 2 },
    description: "赤褐色の有毒な気体。非常に強力なシールドを貼るが、反動で自身も毒に侵される。",
    testPlayEffect: "・自分に5のシールドを付与する\n・さらに墓地から好きなカードを1枚選び手札に加える",
    implemented: true
  },
  {
    name: "過酸化水素",
    formula: "H2O2",
    formulaDisplay: (<span>H<sub>2</sub>O<sub>2</sub></span>),
    elements: { H: 2, O: 2 },
    description: "漂白剤や消毒剤として使われる。激しい酸化力で敵を蝕みつつ、自身を保護するシールドを生成する。",
    testPlayEffect: "・敵に2ダメージを与える\n・自身に3 of シールドを付与し、墓地の水素（H）カードをすべて山札に戻す",
    implemented: true
  },
  // 未実装レシピのプレースホルダー（図鑑に51種の一部として表記）
  { name: "炭酸", formula: "H2CO3", formulaDisplay: (<span>H<sub>2</sub>CO<sub>3</sub></span>), elements: { H: 2, C: 1, O: 3 }, description: "爽快な気泡。二酸化炭素が水に溶けたもの。大量のダメージを与え、さらに手札の枚数に応じた強力な毒素を流し込む。", testPlayEffect: "・敵に5ダメージを与える\n・カードを3枚引く\n・引いた後の手札の枚数分「毒デバフ」を敵に付与する", implemented: true },
  { name: "シュウ酸", formula: "H2C2O4", formulaDisplay: (<span>H<sub>2</sub>C<sub>2</sub>O<sub>4</sub></span>), elements: { H: 2, C: 2, O: 4 }, description: "植物に含まれる酸。効果は今後実装予定。", implemented: false },
  { name: "酢酸", formula: "CH3COOH", formulaDisplay: (<span>CH<sub>3</sub>COOH</span>), elements: { C: 2, H: 4, O: 2 }, description: "酸味の主成分。手札上限拡張が必要なレシピ。", implemented: false },
  { name: "硝酸", formula: "HNO3", formulaDisplay: (<span>HNO<sub>3</sub></span>), elements: { H: 1, N: 1, O: 3 }, description: "極めて強い酸性を持つ。激しい反応性で敵にダメージを与え、墓地から好きなカードを2枚手札に戻す。", testPlayEffect: "・敵に4ダメージを与える\n・墓地から好きなカードを2枚選んで手札に加える", implemented: true },
  { name: "亜硝酸", formula: "HNO2", formulaDisplay: (<span>HNO<sub>2</sub></span>), elements: { H: 1, N: 1, O: 2 }, description: "不安定な一価の酸。敵にダメージを与え、墓地から好きなカードを1枚手札に戻す。さらにこの合成に使用したカードは墓地に行く代わりに山札に戻してシャッフルされる。", testPlayEffect: "・敵に3ダメージを与える\n・墓地から好きなカードを1枚選んで手札に加える\n・この合成に使用したカードは墓地に行く代わりに山札に戻し、山札をシャッフルする", implemented: true },
  { name: "塩化ナトリウム", formula: "NaCl", formulaDisplay: (<span>NaCl</span>), elements: {}, description: "食塩。ClとNaの追加元素が必要なレシピ。効果は今後実装予定。", implemented: false },
  { name: "二酸化硫黄", formula: "SO2", formulaDisplay: (<span>SO<sub>2</sub></span>), elements: {}, description: "火山ガスに含まれる。Sの追加元素が必要なレシピ。", implemented: false },
  { name: "硫酸", formula: "H2SO4", formulaDisplay: (<span>H<sub>2</sub>SO<sub>4</sub></span>), elements: {}, description: "極めて危険な強酸。Sが必要なレシピ。", implemented: false },
  { name: "酸化銅", formula: "CuO", formulaDisplay: (<span>CuO</span>), elements: {}, description: "黒色の粉末。Cuの追加元素が必要なレシピ。", implemented: false },
  { name: "酸化鉄", formula: "Fe2O3", formulaDisplay: (<span>Fe<sub>2</sub>O<sub>3</sub></span>), elements: {}, description: "赤サビ。Feの追加元素が必要なレシピ。", implemented: false },
];

// 初期デッキ定義 (H:6, O:6, C:4, N:4)
const INITIAL_DECK_TYPES: ElementType[] = [
  "H", "H", "H", "H", "H", "H",
  "O", "O", "O", "O", "O", "O",
  "C", "C", "C", "C",
  "N", "N", "N", "N"
];

// カード生成用ユニークID付きヘルパー
const createCard = (type: ElementType): ElementCard => {
  const def = ELEMENT_DEFS[type];
  return {
    id: `card-${Math.random().toString(36).substr(2, 9)}`,
    type,
    ...def
  };
};

// 敵テンプレート作成
const createEnemyTemplate = (type: "slime" | "bat" | "ghost"): Enemy => {
  if (type === "slime") {
    return {
      id: "enemy-slime",
      name: "スライム",
      hp: 10,
      maxHp: 10,
      shield: 0,
      debuffs: [],
      traitName: "液状生命体",
      traitDescription: "H（水素）が含まれた化合物から受ける通常ダメージを1軽減する。",
      behaviorType: "random_equal",
      behaviors: [
        {
          name: "ふるえる",
          description: "プレイヤーに2ダメージを与える。",
          action: (p, e, isFeared) => {
            let dmg = isFeared ? 1 : 2; // 2の半減(切り捨て)は1
            let finalDmg = Math.max(0, dmg - p.shield);
            let shieldDmg = Math.min(p.shield, dmg);
            return {
              player: { ...p, hp: Math.max(0, p.hp - finalDmg), shield: p.shield - shieldDmg },
              enemy: e,
              log: `スライムの「ふるえる」！プレイヤーに ${dmg} ダメージを与えた！${shieldDmg > 0 ? ` (シールドが${shieldDmg}吸収)` : ""}`
            };
          }
        },
        {
          name: "ひろがる",
          description: "自身に4のシールドを付与する。",
          action: (p, e) => {
            return {
              player: p,
              enemy: { ...e, shield: e.shield + 4 },
              log: "スライムの「ひろがる」！自身に4のシールドを付与した。"
            };
          }
        }
      ],
      imageColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
    };
  } else if (type === "bat") {
    return {
      id: "enemy-bat",
      name: "バット",
      hp: 12,
      maxHp: 12,
      shield: 0,
      debuffs: [],
      traitName: "浮遊",
      traitDescription: "デバフによって行動不能にならない。（※今回のゲームには行動不能デバフはありません）",
      behaviorType: "random_weight",
      behaviors: [
        {
          name: "噛み付く",
          description: "プレイヤーに4ダメージを与える。",
          weight: 90,
          action: (p, e, isFeared) => {
            let dmg = isFeared ? 2 : 4; // 4の半減は2
            let finalDmg = Math.max(0, dmg - p.shield);
            let shieldDmg = Math.min(p.shield, dmg);
            return {
              player: { ...p, hp: Math.max(0, p.hp - finalDmg), shield: p.shield - shieldDmg },
              enemy: e,
              log: `バットの「噛み付く」！プレイヤーに ${dmg} ダメージを与えた！`
            };
          }
        },
        {
          name: "吸血",
          description: "プレイヤーに6ダメージを与え、自身の体力を3回復する。",
          weight: 10,
          action: (p, e, isFeared) => {
            let dmg = isFeared ? 3 : 6; // 6の半減は3
            let finalDmg = Math.max(0, dmg - p.shield);
            let shieldDmg = Math.min(p.shield, dmg);
            let healed = Math.min(e.maxHp - e.hp, 3);
            return {
              player: { ...p, hp: Math.max(0, p.hp - finalDmg), shield: p.shield - shieldDmg },
              enemy: { ...e, hp: e.hp + healed },
              log: `バットの「吸血」！プレイヤーに ${dmg} ダメージを与え、自身のHPを ${healed} 回復した！`
            };
          }
        }
      ],
      imageColor: "bg-red-500/20 text-red-400 border-red-500/50"
    };
  } else {
    // ghost
    return {
      id: "enemy-ghost",
      name: "ゴースト",
      hp: 14,
      maxHp: 14,
      shield: 0,
      debuffs: [],
      traitName: "幽体",
      traitDescription: "デバフ（毒など）によってダメージを受けない。",
      behaviorType: "fixed",
      fixedIndex: 0,
      behaviors: [
        {
          name: "ポルターガイスト",
          description: "プレイヤーに3ダメージを与える。",
          action: (p, e, isFeared) => {
            let dmg = isFeared ? 1 : 3; // 3の半減(切り捨て)は1
            let finalDmg = Math.max(0, dmg - p.shield);
            let shieldDmg = Math.min(p.shield, dmg);
            return {
              player: { ...p, hp: Math.max(0, p.hp - finalDmg), shield: p.shield - shieldDmg },
              enemy: e,
              log: `ゴーストの「ポルターガイスト」！プレイヤーに ${dmg} ダメージを与えた！`
            };
          }
        },
        {
          name: "恐怖の根源",
          description: "プレイヤーに「デバフ：恐怖」（カウント1）を付与する。",
          action: (p, e) => {
            const existingFear = p.debuffs.find(d => d.name === "恐怖");
            let newDebuffs = [...p.debuffs];
            if (existingFear) {
              existingFear.count += 1;
            } else {
              newDebuffs.push({
                name: "恐怖",
                count: 1,
                description: "与えるダメージが半減する（切り捨て）。自分のターン終了時にカウントが1減少し、0になると消滅。"
              });
            }
            return {
              player: { ...p, debuffs: newDebuffs },
              enemy: e,
              log: `ゴーストの「恐怖の根源」！プレイヤーに「デバフ：恐怖（カウント1）」を付与した。`
            };
          }
        }
      ],
      imageColor: "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/50"
    };
  }
};

export default function App() {
  // --- Permanent Dungeon State ---
  const [gold, setGold] = useState<number>(100);
  const [handLimit, setHandLimit] = useState<number>(6);
  const [handLimitUpgradeCount, setHandLimitUpgradeCount] = useState<number>(0);
  const [ownedArtifacts, setOwnedArtifacts] = useState<string[]>([]);
  const [globalDeck, setGlobalDeck] = useState<ElementCard[]>([]);
  const [dungeonMap, setDungeonMap] = useState<DungeonNode[]>([]);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  
  // イベントやショップ関連の状態
  const [activeEvent, setActiveEvent] = useState<{
    type: "heal" | "gold" | "card";
    value: number | string;
    description: string;
  } | null>(null);
  
  // ショップアイテムの状態
  const [shopCards, setShopCards] = useState<{ type: ElementType; price: number; id: string }[]>([]);
  const [shopArtifacts, setShopArtifacts] = useState<{ name: string; price: number; id: string }[]>([]);
  const [shopHealPrice, setShopHealPrice] = useState<number>(40);
  const [shopMaxHpPrice, setShopMaxHpPrice] = useState<number>(100);
  
  // デッキ消滅モーダル
  const [showPurgeModal, setShowPurgeModal] = useState<boolean>(false);
  const [purgeSelectedCardIds, setPurgeSelectedCardIds] = useState<string[]>([]);
  const [purgeAftermathCallback, setPurgeAftermathCallback] = useState<(() => void) | null>(null);

  // --- Game State ---
  const [player, setPlayer] = useState<Player>({
    hp: 20,
    maxHp: 20,
    shield: 0,
    debuffs: []
  });

  const [enemy, setEnemy] = useState<Enemy | null>(null);
  const [gameState, setGameState] = useState<"title" | "dungeon_map" | "battle" | "shop" | "event" | "victory" | "gameover" | "game_clear">("title");
  
  // デッキ・手札関連
  const [deck, setDeck] = useState<ElementCard[]>([]);
  const [hand, setHand] = useState<ElementCard[]>([]);
  const [grave, setGrave] = useState<ElementCard[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [showGraveSalvage, setShowGraveSalvage] = useState<boolean>(false);
  const [salvageCount, setSalvageCount] = useState<number>(0);
  const [tempEffectZone, setTempEffectZone] = useState<ElementCard[]>([]);
  const [activeSynthesizedCompound, setActiveSynthesizedCompound] = useState<string | null>(null);

  // 非同期の setTimeout コールバック内などで最新のカードデータを参照するための refs
  const deckRef = useRef(deck);
  const handRef = useRef(hand);
  const graveRef = useRef(grave);

  useEffect(() => {
    deckRef.current = deck;
  }, [deck]);

  useEffect(() => {
    handRef.current = hand;
  }, [hand]);

  useEffect(() => {
    graveRef.current = grave;
  }, [grave]);
  
  // バトル履歴
  const [turn, setTurn] = useState<number>(1);
  const [isPlayerTurn, setIsPlayerTurn] = useState<boolean>(true);
  const [thisTurnH2OSynthesized, setThisTurnH2OSynthesized] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);
  
  // UI関連
  const [activeTab, setActiveTab] = useState<"battle" | "recipes">("battle");
  const [hoveredTrait, setHoveredTrait] = useState<{ name: string; desc: string } | null>(null);
  const [hoveredDebuff, setHoveredDebuff] = useState<string | null>(null);
  const [viewingPile, setViewingPile] = useState<"deck" | "grave" | null>(null);

  // --- Functions ---

  // 戦闘ログ追加
  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev]);
  };

  // 敵の次の行動を決定して予告を更新する
  const updateEnemyIntent = (tgtEnemy: Enemy): Enemy => {
    const updated = { ...tgtEnemy };
    if (updated.behaviorType === "random_equal") {
      const idx = Math.floor(Math.random() * updated.behaviors.length);
      const b = updated.behaviors[idx];
      updated.nextIntent = b.name;
      updated.nextIntentDesc = b.description;
    } else if (updated.behaviorType === "random_weight") {
      const r = Math.random() * 100;
      let acc = 0;
      let chosen = updated.behaviors[0];
      for (const b of updated.behaviors) {
        acc += b.weight || 0;
        if (r <= acc) {
          chosen = b;
          break;
        }
      }
      updated.nextIntent = chosen.name;
      updated.nextIntentDesc = chosen.description;
    } else if (updated.behaviorType === "fixed") {
      const idx = updated.fixedIndex ?? 0;
      const b = updated.behaviors[idx];
      updated.nextIntent = b.name;
      updated.nextIntentDesc = b.description;
    }
    return updated;
  };

  // バトル開始初期化
  // バトル開始初期化
  const startBattle = (enemyType: "slime" | "bat" | "ghost", isBoss: boolean = false) => {
    // プレイヤーリセット (一時的な戦闘ステータスリセット)
    setPlayer(prev => ({
      hp: prev.hp <= 0 ? prev.maxHp : prev.hp,
      maxHp: prev.maxHp,
      shield: 0,
      debuffs: []
    }));

    // 敵テンプレート作成、予告作成
    let rawEnemy = createEnemyTemplate(enemyType);
    if (isBoss) {
      rawEnemy.maxHp *= 2;
      rawEnemy.hp = rawEnemy.maxHp;
      rawEnemy.name = `${rawEnemy.name} (BOSS)`;
    }
    rawEnemy = updateEnemyIntent(rawEnemy);
    setEnemy(rawEnemy);

    // グローバルデッキからシャッフルして戦闘用山札を作成
    const shuffled = [...globalDeck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    setDeck(shuffled);
    setGrave([]);
    setHand([]);
    setSelectedCardIds([]);
    
    // ターン数初期化
    setTurn(1);
    setIsPlayerTurn(true);
    setThisTurnH2OSynthesized(false);
    setLogs([]);
    setGameState("battle");
    setActiveTab("battle");

    // 初期ドロー枚数の算出
    let initialDrawCount = 5;
    if (ownedArtifacts.includes("丸底フラスコ")) {
      initialDrawCount += 1;
    }
    if (ownedArtifacts.includes("割れたフラスコ")) {
      initialDrawCount -= 1;
    }

    // 水道水の効果
    const extraCards: ElementCard[] = [];
    if (ownedArtifacts.includes("水道水")) {
      extraCards.push(createCard("H"));
      addLog("【水道水の効果】1ターン目の開始時、手札にH（水素）を1枚生成しました。");
    }

    // ドロー実行
    drawCards(shuffled, extraCards, [], initialDrawCount);
  };

  // 1枚ずつのドロー処理（再帰的/バッチ処理）
  const drawCards = (currentDeck: ElementCard[], currentHand: ElementCard[], currentGrave: ElementCard[], count: number) => {
    let d = [...currentDeck];
    let h = [...currentHand];
    let g = [...currentGrave];
    let drawnCount = 0;

    for (let i = 0; i < count; i++) {
      // 手札上限チェック
      if (h.length >= handLimit) {
        addLog("【手札上限】手札が上限枚数に達したため、これ以上カードを引くことができません。");
        break;
      }

      if (d.length === 0) {
        if (g.length === 0) {
          // 山札も墓地も空ならそれ以上引けない
          break;
        }
        // 墓地をシャッフルして山札へ
        const reshuffled = [...g];
        for (let x = reshuffled.length - 1; x > 0; x--) {
          const y = Math.floor(Math.random() * (x + 1));
          [reshuffled[x], reshuffled[y]] = [reshuffled[y], reshuffled[x]];
        }
        d = reshuffled;
        g = [];
        addLog("【山札再構築】山札が空になったため、墓地のカードをシャッフルして山札を再構築しました。");
      }

      // 1枚ドロー
      const card = d.pop();
      if (card) {
        h.push(card);
        drawnCount++;
      }
    }

    setDeck(d);
    setHand(h);
    setGrave(g);
    if (drawnCount > 0) {
      addLog(`山札からカードを ${drawnCount} 枚引きました。`);
    }
  };

  const cleanupAfterSalvage = (currentTempZone: ElementCard[], overrideCompoundName?: string | null) => {
    const activeCompound = overrideCompoundName !== undefined ? overrideCompoundName : activeSynthesizedCompound;
    if (currentTempZone.length > 0) {
      if (activeCompound === "亜硝酸") {
        // 山札に戻してシャッフル
        setDeck(prevDeck => {
          let updatedDeck = [...prevDeck, ...currentTempZone];
          // シャッフル
          for (let i = updatedDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [updatedDeck[i], updatedDeck[j]] = [updatedDeck[j], updatedDeck[i]];
          }
          return updatedDeck;
        });
        addLog(`【亜硝酸の効果】合成に使用した素材カード ${currentTempZone.length} 枚をすべて山札に戻し、シャッフルしました。`);
      } else {
        // 墓地に送る
        setGrave(prevGrave => [...prevGrave, ...currentTempZone]);
      }
    }
    setTempEffectZone([]);
    setActiveSynthesizedCompound(null);
    setSalvageCount(0);
    setShowGraveSalvage(false);
  };

  const handleSalvageCard = (cardId: string) => {
    const targetCard = grave.find(c => c.id === cardId);
    if (!targetCard) {
      cleanupAfterSalvage(tempEffectZone);
      return;
    }
    
    // 手札に追加
    setHand(prevHand => [...prevHand, targetCard]);
    // 墓地から削除
    setGrave(prevGrave => prevGrave.filter(c => c.id !== cardId));
    
    addLog(`墓地から「${targetCard.name}」を手札に戻しました。`);

    const nextCount = salvageCount - 1;
    setSalvageCount(nextCount);

    if (nextCount <= 0 || (grave.length - 1) <= 0) {
      cleanupAfterSalvage(tempEffectZone);
    } else {
      addLog(`墓地からもう 1 枚手札に加えるカードを選んでください（残り ${nextCount} 枚）。`);
    }
  };

  // カード選択トグル
  const toggleCardSelection = (id: string) => {
    setSelectedCardIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // 現在選択中のカードから、レシピに完全一致する化合物があるかをチェック
  const getSelectedElementsCount = () => {
    const counts: { [key in ElementType]?: number } = {};
    selectedCardIds.forEach(id => {
      const card = hand.find(c => c.id === id);
      if (card) {
        counts[card.type] = (counts[card.type] || 0) + 1;
      }
    });
    return counts;
  };

  const checkMatchingCompound = (): CompoundRecipe | null => {
    if (selectedCardIds.length === 0) return null;
    const currentCounts = getSelectedElementsCount();

    // 選択された元素の全種類
    const currentKeys = Object.keys(currentCounts) as ElementType[];

    // RECIPESの中で完全に過不足なく一致するものを探す
    for (const recipe of RECIPES) {
      if (!recipe.implemented) continue;
      const recipeKeys = Object.keys(recipe.elements) as ElementType[];

      // 元素の種類数が異なる場合は不一致
      if (currentKeys.length !== recipeKeys.length) continue;

      // 各元素の個数が完全に一致するか確認
      let match = true;
      for (const k of recipeKeys) {
        if (currentCounts[k] !== recipe.elements[k]) {
          match = false;
          break;
        }
      }

      if (match) {
        return recipe;
      }
    }
    return null;
  };

  const matchedCompound = checkMatchingCompound();

  // 合成確定ボタンが押された時
  const handleSynthesize = () => {
    if (!matchedCompound || !enemy) return;

    addLog(`【合成成功】 ${matchedCompound.name} （${matchedCompound.formula}）を合成しました！`);

    let nextPlayer = { ...player };
    let nextEnemy = { ...enemy };
    let compoundLog = "";
    let drawCountAfter = 0;
    let returnHydrogenAfter = false;
    let triggerGraveSalvage = false;
    let salvageCountNeeded = 0;

    // プレイヤーにかかっている「恐怖」デバフチェック
    const isPlayerFeared = player.debuffs.some(d => d.name === "恐怖" && d.count > 0);

    const usedCards = hand.filter(c => selectedCardIds.includes(c.id));
    const remainingHand = hand.filter(c => !selectedCardIds.includes(c.id));

    let updatedHand = remainingHand;
    let updatedDeck = [...deck];
    let updatedGrave = [...grave];

    // 各化合物の具体的な効果処理
    switch (matchedCompound.name) {
      case "水": {
        // 敵に3ダメージ、自身に3シールド、1枚ドロー
        let dmg = 3;
        if (isPlayerFeared) {
          dmg = 1; // 3の半減は1
          addLog("（プレイヤーが「恐怖」状態のため、与えるダメージが半減しました）");
        }
        // 敵がスライムなら〈液状生命体〉により水素含むダメージ-1
        if (enemy.id === "enemy-slime" && dmg > 0) {
          dmg = Math.max(0, dmg - 1);
          addLog("（スライムの特性〈液状生命体〉により、水素を含む化合物からのダメージが1軽減されました）");
        }

        let finalDmg = Math.max(0, dmg - nextEnemy.shield);
        let shieldDmg = Math.min(nextEnemy.shield, dmg);
        
        nextEnemy.shield -= shieldDmg;
        nextEnemy.hp = Math.max(0, nextEnemy.hp - finalDmg);
        nextPlayer.shield += 3;
        drawCountAfter = 1;
        
        setThisTurnH2OSynthesized(true);
        compoundLog = `「水」の効果：敵に ${dmg} ダメージを与え、自分に 3 のシールドを付与し、カードを 1 枚引いた。${shieldDmg > 0 ? `(敵のシールドが ${shieldDmg} 吸収)` : ""}`;
        break;
      }
      case "アンモニア": {
        // 敵に4ダメージ。水（H2O）を合成していたなら毒デバフ（カウント+3）
        let dmg = 4;
        if (isPlayerFeared) {
          dmg = 2; // 4の半減は2
          addLog("（プレイヤーが「恐怖」状態のため、与えるダメージが半減しました）");
        }
        if (enemy.id === "enemy-slime" && dmg > 0) {
          dmg = Math.max(0, dmg - 1);
          addLog("（スライムの特性〈液状生命体〉により、水素を含む化合物からのダメージが1軽減されました）");
        }

        let finalDmg = Math.max(0, dmg - nextEnemy.shield);
        let shieldDmg = Math.min(nextEnemy.shield, dmg);
        
        nextEnemy.shield -= shieldDmg;
        nextEnemy.hp = Math.max(0, nextEnemy.hp - finalDmg);

        let poisonAdded = false;
        if (thisTurnH2OSynthesized) {
          const existingPoison = nextEnemy.debuffs.find(d => d.name === "毒");
          if (existingPoison) {
            existingPoison.count += 3;
          } else {
            nextEnemy.debuffs.push({
              name: "毒",
              count: 3,
              description: "相手のターン終了時、このカウント数だけのダメージを受ける。さらに蓄積するとカウントが増える。"
            });
          }
          poisonAdded = true;
        }

        compoundLog = `「アンモニア」の効果：敵に ${dmg} ダメージを与えた。${poisonAdded ? "（このターン、すでに水を合成していたため「毒デバフ（カウント3）」を付与！）" : ""}`;
        break;
      }
      case "一酸化炭素": {
        // 敵に毒デバフ（カウント1）、1枚ドロー
        const existingPoison = nextEnemy.debuffs.find(d => d.name === "毒");
        if (existingPoison) {
          existingPoison.count += 1;
        } else {
          nextEnemy.debuffs.push({
            name: "毒",
            count: 1,
            description: "相手のターン終了時、このカウント数だけのダメージを受ける。さらに蓄積するとカウントが増える。"
          });
        }
        drawCountAfter = 1;
        compoundLog = `「一酸化炭素」の効果：敵に「毒デバフ（カウント1）」を付与し、カードを 1 枚引いた。`;
        break;
      }
      case "二酸化炭素": {
        // 敵に4ダメージ、毒デバフ（カウント1）
        let dmg = 4;
        if (isPlayerFeared) {
          dmg = 2; // 4の半減は2
          addLog("（プレイヤーが「恐怖」状態のため、与えるダメージが半減しました）");
        }

        let finalDmg = Math.max(0, dmg - nextEnemy.shield);
        let shieldDmg = Math.min(nextEnemy.shield, dmg);
        
        nextEnemy.shield -= shieldDmg;
        nextEnemy.hp = Math.max(0, nextEnemy.hp - finalDmg);

        const existingPoison = nextEnemy.debuffs.find(d => d.name === "毒");
        if (existingPoison) {
          existingPoison.count += 1;
        } else {
          nextEnemy.debuffs.push({
            name: "毒",
            count: 1,
            description: "相手のターン終了時、このカウント数だけのダメージを受ける。さらに蓄積するとカウントが増える。"
          });
        }

        compoundLog = `「二酸化炭素」の効果：敵に ${dmg} ダメージを与え、さらに「毒デバフ（カウント1）」を付与した。`;
        break;
      }
      case "一酸化窒素": {
        // 自分に2シールド、墓地から1枚選んで手札に加える
        nextPlayer.shield += 2;
        triggerGraveSalvage = true;
        salvageCountNeeded = 1;
        compoundLog = `「一酸化窒素」の効果：自分に 2 のシールドを付与した。`;
        break;
      }
      case "二酸化窒素": {
        // 自分に5シールド、墓地から1枚選んで手札に加える
        nextPlayer.shield += 5;
        triggerGraveSalvage = true;
        salvageCountNeeded = 1;
        compoundLog = `「二酸化窒素」の効果：自分に 5 のシールドを付与した。`;
        break;
      }
      case "過酸化水素": {
        // 敵に2ダメージ、自身に3シールド、墓地の水素を全て山札に戻す
        let dmg = 2;
        if (isPlayerFeared) {
          dmg = 1;
          addLog("（プレイヤーが「恐怖」状態のため、与えるダメージが半減しました）");
        }
        if (enemy.id === "enemy-slime" && dmg > 0) {
          dmg = Math.max(0, dmg - 1);
          addLog("（スライムの特性〈液状生命体〉により、水素を含む化合物からのダメージが1軽減されました）");
        }

        let finalDmg = Math.max(0, dmg - nextEnemy.shield);
        let shieldDmg = Math.min(nextEnemy.shield, dmg);
        
        nextEnemy.shield -= shieldDmg;
        nextEnemy.hp = Math.max(0, nextEnemy.hp - finalDmg);
        nextPlayer.shield += 3;
        returnHydrogenAfter = true;

        compoundLog = `「過酸化水素」の効果：敵に ${dmg} ダメージを与え、自分に 3 のシールドを付与した。`;
        break;
      }
      case "炭酸": {
        // 1. 敵に5ダメージ
        let dmg = 5;
        if (isPlayerFeared) {
          dmg = 2; // 5の半減は2
          addLog("（プレイヤーが「恐怖」状態のため、与えるダメージが半減しました）");
        }
        if (enemy.id === "enemy-slime" && dmg > 0) {
          dmg = Math.max(0, dmg - 1);
          addLog("（スライムの特性〈液状生命体〉により、水素を含む化合物からのダメージが1軽減されました）");
        }

        let finalDmg = Math.max(0, dmg - nextEnemy.shield);
        let shieldDmg = Math.min(nextEnemy.shield, dmg);
        
        nextEnemy.shield -= shieldDmg;
        nextEnemy.hp = Math.max(0, nextEnemy.hp - finalDmg);

        // 2. カードを3枚引く（即時、ローカル変数で処理）
        let tempDeck = [...deck];
        let tempHand = [...remainingHand];
        let tempGrave = [...grave];
        let drawnCount = 0;
        const toDraw = 3;

        for (let i = 0; i < toDraw; i++) {
          if (tempDeck.length === 0) {
            if (tempGrave.length > 0) {
              tempDeck = [...tempGrave];
              tempGrave = [];
              for (let x = tempDeck.length - 1; x > 0; x--) {
                const y = Math.floor(Math.random() * (x + 1));
                [tempDeck[x], tempDeck[y]] = [tempDeck[y], tempDeck[x]];
              }
              addLog("【山札再構築】墓地のカードをシャッフルして山札を再構築しました。");
            } else {
              break;
            }
          }
          const card = tempDeck.pop();
          if (card) {
            tempHand.push(card);
            drawnCount++;
          }
        }

        updatedHand = tempHand;
        updatedDeck = tempDeck;
        updatedGrave = tempGrave;

        if (drawnCount > 0) {
          addLog(`山札からカードを ${drawnCount} 枚引きました。`);
        }

        // 3. ドロー後の手札枚数をカウントして、その数だけ毒を付与
        const poisonCount = updatedHand.length;
        if (poisonCount > 0) {
          const existingPoison = nextEnemy.debuffs.find(d => d.name === "毒");
          if (existingPoison) {
            existingPoison.count += poisonCount;
          } else {
            nextEnemy.debuffs.push({
              name: "毒",
              count: poisonCount,
              description: "相手のターン終了時、このカウント数だけのダメージを受ける。さらに蓄積するとカウントが増える。"
            });
          }
        }

        compoundLog = `「炭酸」の効果：敵に ${dmg} ダメージを与え、カードを ${drawnCount} 枚引き、手札の枚数（${poisonCount}枚）と同じカウント数 ${poisonCount} の「毒デバフ」を敵に付与した。`;
        break;
      }
      case "硝酸": {
        // 敵に4ダメージ、墓地から2枚回収
        let dmg = 4;
        if (isPlayerFeared) {
          dmg = 2; // 4の半減は2
          addLog("（プレイヤーが「恐怖」状態のため、与えるダメージが半減しました）");
        }
        if (enemy.id === "enemy-slime" && dmg > 0) {
          dmg = Math.max(0, dmg - 1);
          addLog("（スライムの特性〈液状生命体〉により、水素を含む化合物からのダメージが1軽減されました）");
        }

        let finalDmg = Math.max(0, dmg - nextEnemy.shield);
        let shieldDmg = Math.min(nextEnemy.shield, dmg);
        
        nextEnemy.shield -= shieldDmg;
        nextEnemy.hp = Math.max(0, nextEnemy.hp - finalDmg);

        triggerGraveSalvage = true;
        salvageCountNeeded = 2;
        compoundLog = `「硝酸」の効果：敵に ${dmg} ダメージを与えた。さらに墓地から好きなカードを2枚まで回収する。`;
        break;
      }
      case "亜硝酸": {
        // 敵に3ダメージ、墓地から1枚回収、素材は山札に戻す
        let dmg = 3;
        if (isPlayerFeared) {
          dmg = 1; // 3の半減は1
          addLog("（プレイヤーが「恐怖」状態のため、与えるダメージが半減しました）");
        }
        if (enemy.id === "enemy-slime" && dmg > 0) {
          dmg = Math.max(0, dmg - 1);
          addLog("（スライムの特性〈液状生命体〉により、水素を含む化合物からのダメージが1軽減されました）");
        }

        let finalDmg = Math.max(0, dmg - nextEnemy.shield);
        let shieldDmg = Math.min(nextEnemy.shield, dmg);
        
        nextEnemy.shield -= shieldDmg;
        nextEnemy.hp = Math.max(0, nextEnemy.hp - finalDmg);

        triggerGraveSalvage = true;
        salvageCountNeeded = 1;
        compoundLog = `「亜硝酸」の効果：敵に ${dmg} ダメージを与えた。さらに墓地から好きなカードを1枚回収し、この合成に使用したカードは墓地に行く代わりに山札に戻してシャッフルする。`;
        break;
      }
      default:
        break;
    }

    addLog(compoundLog);

    // 墓地回収が起動しない場合
    if (!triggerGraveSalvage) {
      let finalGrave = [...updatedGrave, ...usedCards];
      let finalDeck = [...updatedDeck];

      // 過酸化水素：墓地の水素（H）をすべて山札に戻す
      if (returnHydrogenAfter) {
        const hydrogenInGrave = finalGrave.filter(c => c.type === "H");
        if (hydrogenInGrave.length > 0) {
          // 墓地から水素を削除
          finalGrave = finalGrave.filter(c => c.type !== "H");
          // 山札に追加
          finalDeck = [...finalDeck, ...hydrogenInGrave];
          
          // シャッフル
          for (let i = finalDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [finalDeck[i], finalDeck[j]] = [finalDeck[j], finalDeck[i]];
          }
          addLog(`【山札還流】墓地の水素（H）カード ${hydrogenInGrave.length} 枚をすべて山札に戻し、シャッフルしました。`);
        } else {
          addLog("（墓地に水素カードがなかったため、山札に戻す処理は行われませんでした）");
        }
      }

      setGrave(finalGrave);
      setHand(updatedHand);
      setSelectedCardIds([]);
      setDeck(finalDeck);

      // 敵の死亡チェック
      if (nextEnemy.hp <= 0) {
        setEnemy(nextEnemy);
        setPlayer(nextPlayer);
        handleBattleVictory();
        return;
      } else {
        setEnemy(nextEnemy);
        setPlayer(nextPlayer);
      }

      // ドロー処理がある場合
      if (drawCountAfter > 0) {
        drawCards(finalDeck, updatedHand, finalGrave, drawCountAfter);
      }
    } else {
      // 墓地回収（サルベージ）が起動する場合
      // 素材カード（usedCards）は墓地に混ぜずに、一時領域に保管する
      setGrave(updatedGrave);
      setHand(updatedHand);
      setSelectedCardIds([]);
      setDeck(updatedDeck);

      // 敵の死亡チェック
      if (nextEnemy.hp <= 0) {
        setEnemy(nextEnemy);
        setPlayer(nextPlayer);
        // すぐにクリーンアップして素材を処理
        cleanupAfterSalvage(usedCards, matchedCompound.name);
        handleBattleVictory();
        return;
      } else {
        setEnemy(nextEnemy);
        setPlayer(nextPlayer);
      }

      // 墓地回収画面の起動
      if (updatedGrave.length === 0) {
        addLog("（墓地が空のため、カードを回収できませんでした）");
        cleanupAfterSalvage(usedCards, matchedCompound.name);
      } else {
        const actualSalvageCount = Math.min(salvageCountNeeded, updatedGrave.length);
        setShowGraveSalvage(true);
        setTempEffectZone(usedCards);
        setActiveSynthesizedCompound(matchedCompound.name);
        setSalvageCount(actualSalvageCount);
        addLog(`墓地から手札に加えるカードを ${actualSalvageCount} 枚選んでください。`);
      }
    }
  };

  // プレイヤーのターン終了（＝敵のターン開始）
  const endPlayerTurn = () => {
    if (!enemy) return;
    setIsPlayerTurn(false);
    addLog("【ターン終了】プレイヤーのターンが終了しました。");

    // 1. プレイヤーのターン終了時デバフ処理（毒、恐怖など）
    let nextPlayer = { ...player };
    
    // 毒ダメージの処理
    const poisonDebuff = nextPlayer.debuffs.find(d => d.name === "毒");
    if (poisonDebuff && poisonDebuff.count > 0) {
      const poisonDmg = poisonDebuff.count;
      nextPlayer.hp = Math.max(0, nextPlayer.hp - poisonDmg);
      addLog(`【毒ダメージ】プレイヤーは毒により ${poisonDmg} のダメージを受けた！`);
    }

    // デバフのカウント減少処理
    nextPlayer.debuffs = nextPlayer.debuffs.map(d => {
      return { ...d, count: d.count - 1 };
    }).filter(d => d.count > 0);

    setPlayer(nextPlayer);

    // プレイヤーが毒で死亡したかチェック
    if (nextPlayer.hp <= 0) {
      setGameState("gameover");
      addLog("プレイヤーの体力が尽きました。ゲームオーバー！");
      return;
    }

    // 手札をすべて墓地に送る
    setGrave(prev => [...prev, ...hand]);
    setHand([]);
    setSelectedCardIds([]);

    // 2. 敵のターン実行（一定時間後に発動するとゲームのテンポが良い）
    setTimeout(() => {
      executeEnemyTurn(nextPlayer);
    }, 1000);
  };

  // 敵のターン実行
  const executeEnemyTurn = (currentPlayerState: Player) => {
    if (!enemy) return;

    let nextPlayer = { ...currentPlayerState };
    let nextEnemy = { ...enemy };

    // 敵のシールドを0にリセット（プレイヤーと同様）
    nextEnemy.shield = 0;

    // 敵が恐怖デバフにかかっているか
    const isEnemyFeared = enemy.debuffs.some(d => d.name === "恐怖" && d.count > 0);

    // 現在の予告行動を取得して実行
    const currentIntentName = enemy.nextIntent || enemy.behaviors[0].name;
    const behavior = enemy.behaviors.find(b => b.name === currentIntentName) || enemy.behaviors[0];

    const result = behavior.action(nextPlayer, nextEnemy, isEnemyFeared);
    nextPlayer = result.player;
    nextEnemy = result.enemy;
    addLog(result.log);

    // 敵が固定行動ループの場合はインデックスを更新
    if (nextEnemy.behaviorType === "fixed") {
      const currentIndex = nextEnemy.fixedIndex ?? 0;
      nextEnemy.fixedIndex = (currentIndex + 1) % nextEnemy.behaviors.length;
    }

    // 敵のターン終了時デバフ処理
    const enemyPoison = nextEnemy.debuffs.find(d => d.name === "毒");
    if (enemyPoison && enemyPoison.count > 0) {
      if (nextEnemy.id === "enemy-ghost") {
        addLog("ゴーストの特性〈幽体〉により、毒ダメージが無効化された！");
      } else {
        const poisonDmg = enemyPoison.count;
        nextEnemy.hp = Math.max(0, nextEnemy.hp - poisonDmg);
        addLog(`【毒ダメージ】${nextEnemy.name}は毒により ${poisonDmg} のダメージを受けた！`);
      }
    }

    // 敵のデバフ減少
    nextEnemy.debuffs = nextEnemy.debuffs.map(d => {
      return { ...d, count: d.count - 1 };
    }).filter(d => d.count > 0);

    // プレイヤーの死亡チェック
    if (nextPlayer.hp <= 0) {
      setPlayer(nextPlayer);
      setEnemy(nextEnemy);
      setGameState("gameover");
      addLog("プレイヤーの体力が尽きました。ゲームオーバー！");
      return;
    }

    // 敵が毒で死亡したかチェック
    if (nextEnemy.hp <= 0) {
      setPlayer(nextPlayer);
      setEnemy(nextEnemy);
      handleBattleVictory();
      return;
    }

    // 敵の次のターン予告を決定する
    nextEnemy = updateEnemyIntent(nextEnemy);

    setPlayer(nextPlayer);
    setEnemy(nextEnemy);

    // 3. 次のプレイヤーターン開始
    setTimeout(() => {
      startPlayerTurn(nextPlayer);
    }, 1000);
  };

  // プレイヤーターンの開始
  const startPlayerTurn = (currentPlayerState: Player) => {
    setTurn(prev => prev + 1);
    setIsPlayerTurn(true);
    setThisTurnH2OSynthesized(false);
    addLog(`--- ターン ${turn + 1} (プレイヤーのターン) ---`);

    // プレイヤーのシールドを0にリセット（ターン制限のため）
    setPlayer(prev => ({
      ...prev,
      shield: 0
    }));

    // ターン開始時の引く枚数の算出（基本5枚、丸底フラスコで+1、割れたフラスコで-1）
    let drawCount = 5;
    if (ownedArtifacts.includes("丸底フラスコ")) {
      drawCount += 1;
    }
    if (ownedArtifacts.includes("割れたフラスコ")) {
      drawCount -= 1;
    }

    // カードをドロー
    drawCards(deckRef.current, [], graveRef.current, drawCount);
  };

  // 戦闘勝利処理
  const handleBattleVictory = () => {
    // 勝利報酬ゴールド獲得
    const isBoss = enemy?.name.includes("BOSS");
    const earnedGold = isBoss
      ? Math.floor(Math.random() * 31) + 120 // 120〜150ゴールド
      : Math.floor(Math.random() * 21) + 40;  // 40〜60ゴールド
    
    setGold(prev => prev + earnedGold);
    addLog(`【戦闘勝利】敵を撃破しました！報酬として ${earnedGold} ゴールドを獲得しました！`);
    
    // ダンジョンマップの現在位置を完了状態にする
    if (currentNodeId) {
      setDungeonMap(prev => prev.map(node => {
        if (node.id === currentNodeId) {
          return { ...node, completed: true };
        }
        return node;
      }));
    }
    
    setGameState("victory");
  };

  // ダンジョン開始初期化
  const startDungeon = () => {
    const initialDeck = INITIAL_DECK_TYPES.map(createCard);
    setGlobalDeck(initialDeck);
    setGold(100);
    setHandLimit(6);
    setHandLimitUpgradeCount(0);
    setOwnedArtifacts([]);
    
    // ダンジョンマップ生成
    const newMap = generateDungeonMap();
    setDungeonMap(newMap);
    setCurrentNodeId(null);
    
    setPlayer({
      hp: 20,
      maxHp: 20,
      shield: 0,
      debuffs: []
    });
    
    setGameState("dungeon_map");
  };

  // ショップに入る
  const enterShopNode = (nodeId: string) => {
    setCurrentNodeId(nodeId);
    
    // 金額補正（-20 〜 +20）
    const generatePrice = (base: number) => {
      const offset = Math.floor(Math.random() * 41) - 20; // -20 to +20
      return Math.max(10, base + offset); // 最小10
    };
    
    // カード商品を3つ生成（H, O, C, N からランダムに3つ選出）
    const types: ElementType[] = ["H", "O", "C", "N"];
    const cards = Array.from({ length: 3 }, () => {
      const t = types[Math.floor(Math.random() * types.length)];
      return {
        type: t,
        price: generatePrice(50),
        id: `shop-card-${Math.random().toString(36).substr(2, 9)}`
      };
    });
    
    // まだ持っていない実験器具を並べる
    const allArtifacts = ["丸底フラスコ", "割れたフラスコ", "水道水"];
    const unowned = allArtifacts.filter(art => !ownedArtifacts.includes(art));
    const arts = unowned.map(name => ({
      name,
      price: generatePrice(100),
      id: `shop-art-${Math.random().toString(36).substr(2, 9)}`
    }));
    
    setShopCards(cards);
    setShopArtifacts(arts);
    setShopHealPrice(generatePrice(40));
    setShopMaxHpPrice(generatePrice(100));
    
    setGameState("shop");
  };

  const handleBuyCard = (type: ElementType, price: number, shopCardId: string) => {
    if (gold < price) return;
    setGold(p => p - price);
    setGlobalDeck(prev => [...prev, createCard(type)]);
    setShopCards(prev => prev.filter(c => c.id !== shopCardId));
    addLog(`【ショップ】「${ELEMENT_DEFS[type].name}（${type}）」カードを ${price} Gで購入しました。`);
  };

  const handleBuyArtifact = (name: string, price: number, shopArtId: string) => {
    if (gold < price) return;
    
    const finalizePurchase = () => {
      setGold(p => p - price);
      setShopArtifacts(prev => prev.filter(a => a.id !== shopArtId));
      addLog(`【ショップ】実験器具「${name}」を ${price} Gで購入しました。`);
    };

    if (name === "割れたフラスコ") {
      // 消滅処理が先。デッキが十分（15枚以上）あるかチェック
      if (globalDeck.length < 15) {
        addLog("【ショップ】割れたフラスコを購入するには、デッキに15枚以上のカードが必要です（消滅後に10枚以上残すため）。");
        return;
      }
      triggerBrokenFlaskPurge(() => {
        finalizePurchase();
      });
    } else {
      finalizePurchase();
      setOwnedArtifacts(prev => [...prev, name]);
    }
  };

  const handleBuyHeal = (price: number) => {
    if (gold < price) return;
    if (player.hp >= player.maxHp) {
      addLog("【ショップ】プレイヤーの体力はすでに最大です。");
      return;
    }
    setGold(p => p - price);
    setPlayer(prev => ({
      ...prev,
      hp: Math.min(prev.maxHp, prev.hp + 10)
    }));
    addLog(`【ショップ】体力を10回復しました（消費: ${price} G）。`);
  };

  const handleBuyMaxHp = (price: number) => {
    if (gold < price) return;
    setGold(p => p - price);
    setPlayer(prev => ({
      ...prev,
      maxHp: prev.maxHp + 5,
      hp: prev.hp + 5
    }));
    addLog(`【ショップ】最大体力を+5増加させました（消費: ${price} G）。`);
  };

  const handleBuyHandLimit = () => {
    const prices = [100, 200, 400, 800];
    if (handLimitUpgradeCount >= 4) return;
    const price = prices[handLimitUpgradeCount];
    if (gold < price) return;
    
    setGold(p => p - price);
    setHandLimitUpgradeCount(prev => prev + 1);
    setHandLimit(prev => prev + 1);
    addLog(`【ショップ】手札上限を ${handLimit + 1} に増加させました（消費: ${price} G）。`);
  };

  // イベントに入る
  const enterEventNode = (nodeId: string) => {
    setCurrentNodeId(nodeId);
    
    // ランダムに1つ発動
    const eventType = ["heal", "gold", "card"][Math.floor(Math.random() * 3)] as "heal" | "gold" | "card";
    
    if (eventType === "heal") {
      // 体力10回復
      const healAmount = 10;
      setPlayer(prev => ({
        ...prev,
        hp: Math.min(prev.maxHp, prev.hp + healAmount)
      }));
      setActiveEvent({
        type: "heal",
        value: healAmount,
        description: `古い遺跡から温かい癒やしの水が湧き出ています。プレイヤーの体力が ${healAmount} 回復しました！`
      });
    } else if (eventType === "gold") {
      // ゴールド50〜80獲得
      const goldAmount = Math.floor(Math.random() * 31) + 50; // 50 to 80
      setGold(prev => prev + goldAmount);
      setActiveEvent({
        type: "gold",
        value: goldAmount,
        description: `放置された古い宝箱を見つけました！中から ${goldAmount} ゴールドを手に入れました。`
      });
    } else {
      // 元素カード1枚獲得
      const types: ElementType[] = ["H", "O", "C", "N"];
      const t = types[Math.floor(Math.random() * types.length)];
      const newCard = createCard(t);
      setGlobalDeck(prev => [...prev, newCard]);
      setActiveEvent({
        type: "card",
        value: t,
        description: `漂うエーテル結晶から不思議な引力により、「${ELEMENT_DEFS[t].name}（${t}）」カードがデッキに加わりました！`
      });
    }
    
    // ノードを完了にする
    setDungeonMap(prev => prev.map(node => {
      if (node.id === nodeId) {
        return { ...node, completed: true };
      }
      return node;
    }));
    
    setGameState("event");
  };

  // 割れたフラスコ用の消滅画面の起動
  const triggerBrokenFlaskPurge = (aftermath: () => void) => {
    setPurgeSelectedCardIds([]);
    setPurgeAftermathCallback(() => aftermath);
    setShowPurgeModal(true);
  };

  // 消滅処理の完了
  const handlePurgeComplete = () => {
    if (purgeSelectedCardIds.length !== 5) return;
    
    // globalDeck から選択されたカードを削除
    setGlobalDeck(prev => prev.filter(c => !purgeSelectedCardIds.includes(c.id)));
    
    // 正式に割れたフラスコを追加
    setOwnedArtifacts(prev => [...prev, "割れたフラスコ"]);
    
    setShowPurgeModal(false);
    setPurgeSelectedCardIds([]);
    
    if (purgeAftermathCallback) {
      purgeAftermathCallback();
    }
  };

  // タイトルへ戻る
  const returnToTitle = () => {
    setGameState("title");
    setEnemy(null);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans select-none antialiased">
      {/* HEADER */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-lg border border-cyan-500/30">
            <Beaker className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg md:text-xl tracking-wider text-cyan-400 flex items-center gap-2">
              元素ローグライクカードゲーム 
              <span className="text-xs bg-cyan-950 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded">
                バトルテストプレイ版
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-mono hidden md:block">v1.1.0 (Dungeon, Shop, & Artifacts Sandbox)</p>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* プレイヤーのステータス表示（タイトル画面以外） */}
          {gameState !== "title" && (
            <div className="flex items-center gap-4 text-xs font-mono bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
              <span className="flex items-center gap-1.5 text-rose-400 font-bold">
                <Heart className="w-4 h-4 fill-rose-500/10" />
                HP: {player.hp}/{player.maxHp}
              </span>
              <span className="text-slate-500">|</span>
              <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                🪙 {gold} G
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-cyan-400 font-bold">
                🎴 手札上限: {handLimit}
              </span>
              {ownedArtifacts.length > 0 && (
                <>
                  <span className="text-slate-500">|</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400">実験器具:</span>
                    <span className="bg-slate-950 px-2 py-0.5 rounded text-[10px] text-cyan-300 border border-cyan-900 flex gap-1">
                      {ownedArtifacts.join(", ")}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          <button 
            id="btn-recipes-tab"
            onClick={() => setActiveTab(prev => prev === "recipes" ? "battle" : "recipes")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
              activeTab === "recipes" 
                ? "bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.15)]" 
                : "bg-slate-900 border-slate-700 hover:border-slate-600 hover:bg-slate-800 text-slate-300"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>元素・化合物図鑑</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col gap-6">
        
        <AnimatePresence mode="wait">
          {/* TITLE SCREEN */}
          {gameState === "title" && (
            <motion.div 
              key="title-screen"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col items-center justify-center py-12 px-4 max-w-2xl mx-auto text-center"
            >
              <div className="mb-6 relative">
                <div className="absolute inset-0 bg-cyan-500/10 blur-3xl rounded-full"></div>
                <div className="p-6 bg-slate-900 border border-cyan-500/30 rounded-full inline-block relative">
                  <Sparkles className="w-16 h-16 text-cyan-400 animate-pulse" />
                </div>
              </div>

              <h2 className="text-3xl md:text-4xl font-display font-bold mb-4 tracking-tight text-white">
                元素ローグライク：カードバトル ＆ ダンジョン試作
              </h2>
              
              <p className="text-slate-400 text-sm md:text-base mb-8 max-w-md leading-relaxed">
                化学をテーマにした独自のローグライクカードバトルの試作版です。
                初期元素カードを過不足なく選択して「合成確定」し、強力な化学反応を巻き起こして敵を撃破してください。
              </p>

              {/* DUNGEON START BUTTON */}
              <div className="w-full mb-8">
                <button
                  id="btn-start-dungeon-run"
                  onClick={startDungeon}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-slate-950 font-bold text-base md:text-lg rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:shadow-[0_0_40px_rgba(6,182,212,0.5)] transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-3 cursor-pointer"
                >
                  <Play className="w-6 h-6 fill-slate-950" />
                  <span>仮のダンジョンをテストプレイ（全5マス、ショップ、イベント有）</span>
                </button>
              </div>

              <div className="w-full bg-slate-900/50 border border-slate-800 rounded-xl p-5 mb-8 text-left">
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-1.5 font-display">
                  <Swords className="w-4 h-4 text-cyan-400" />
                  個別戦闘サンドボックス（ダンジョンを通らずに即座に戦闘テスト）
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    id="btn-select-slime"
                    onClick={() => {
                      const initialDeck = INITIAL_DECK_TYPES.map(createCard);
                      setGlobalDeck(initialDeck);
                      setGold(100);
                      startBattle("slime");
                    }}
                    className="p-4 bg-emerald-950/20 border border-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-950/40 rounded-xl text-left transition-all duration-200 group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-emerald-400 font-display">スライム</span>
                      <span className="text-xs bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800">HP 10</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-snug">
                      特性〈液状生命体〉：H（水素）を含む化合物から受けるダメージを1軽減。最も基本的な敵。
                    </p>
                    <div className="mt-3 flex items-center gap-1 text-xs text-emerald-400 font-medium group-hover:translate-x-1 transition-transform">
                      <span>戦闘テスト開始</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </button>

                  <button
                    id="btn-select-bat"
                    onClick={() => {
                      const initialDeck = INITIAL_DECK_TYPES.map(createCard);
                      setGlobalDeck(initialDeck);
                      setGold(100);
                      startBattle("bat");
                    }}
                    className="p-4 bg-red-950/20 border border-red-500/30 hover:border-red-500 hover:bg-red-950/40 rounded-xl text-left transition-all duration-200 group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-red-400 font-display">バット</span>
                      <span className="text-xs bg-red-950 text-red-400 px-2 py-0.5 rounded border border-red-800">HP 12</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-snug">
                      特性〈浮遊〉：行動不能デバフ無効。90%で4ダメージ、10%で強力な「吸血（HP回復）」を使用。
                    </p>
                    <div className="mt-3 flex items-center gap-1 text-xs text-red-400 font-medium group-hover:translate-x-1 transition-transform">
                      <span>戦闘テスト開始</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </button>

                  <button
                    id="btn-select-ghost"
                    onClick={() => {
                      const initialDeck = INITIAL_DECK_TYPES.map(createCard);
                      setGlobalDeck(initialDeck);
                      setGold(100);
                      startBattle("ghost");
                    }}
                    className="p-4 bg-fuchsia-950/20 border border-fuchsia-500/30 hover:border-fuchsia-500 hover:bg-fuchsia-950/40 rounded-xl text-left transition-all duration-200 group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-fuchsia-400 font-display">ゴースト</span>
                      <span className="text-xs bg-fuchsia-950 text-fuchsia-400 px-2 py-0.5 rounded border border-fuchsia-800">HP 14</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-snug">
                      特性〈幽体〉：デバフ（毒など）によるダメージを受けない。攻撃とデバフ「恐怖」を交互に使用。
                    </p>
                    <div className="mt-3 flex items-center gap-1 text-xs text-fuchsia-400 font-medium group-hover:translate-x-1 transition-transform">
                      <span>戦闘テスト開始</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-500 font-mono">
                ※現在のテストプレイ版は、プレイヤーの最大HP 20、初期デッキ 20枚が標準装備されています。
              </div>
            </motion.div>
          )}

          {/* BATTLE SCREEN */}
          {gameState === "battle" && activeTab === "battle" && enemy && (
            <motion.div 
              key="battle-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start"
            >
              {/* LEFT & CENTER: COMBAT FIELD (3 cols) */}
              <div className="lg:col-span-3 flex flex-col gap-6">
                
                {/* STATUS BAR & ACTIONS */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-4">
                    <span className="text-cyan-400 font-bold">ターン {turn}</span>
                    <span className={isPlayerTurn ? "text-green-400 animate-pulse font-bold" : "text-amber-400 font-bold"}>
                      {isPlayerTurn ? "● プレイヤーのターン" : "● 敵のターン..."}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button 
                      id="btn-return-title"
                      onClick={returnToTitle}
                      className="px-2.5 py-1 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded text-slate-300 transition"
                    >
                      敵を選択しなおす
                    </button>
                  </div>
                </div>

                {/* COMBATANTS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block z-10 pointer-events-none">
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-full shadow-lg">
                      <Swords className="w-5 h-5 text-cyan-400 animate-pulse" />
                    </div>
                  </div>

                  {/* PLAYER STATUS */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-3xl rounded-full"></div>
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs bg-cyan-950 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded font-mono font-bold">
                          PLAYER
                        </span>
                        
                        {/* Player Shield Status */}
                        {player.shield > 0 && (
                          <motion.div 
                            initial={{ scale: 0.8 }} 
                            animate={{ scale: 1 }} 
                            className="flex items-center gap-1.5 bg-blue-950 border border-blue-500/50 text-blue-300 px-2.5 py-0.5 rounded-full font-bold text-xs"
                          >
                            <Shield className="w-3.5 h-3.5 fill-blue-500/20" />
                            <span>シールド: {player.shield}</span>
                          </motion.div>
                        )}
                      </div>

                      <h3 className="font-display font-bold text-xl text-white mb-3">プレイヤー</h3>

                      {/* Health Bar */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1.5">
                          <span className="flex items-center gap-1 text-rose-400 font-bold">
                            <Heart className="w-3.5 h-3.5 fill-rose-500/20" /> HP: {player.hp} / {player.maxHp}
                          </span>
                        </div>
                        <div className="w-full bg-slate-950 h-3 rounded-full border border-slate-800 overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-rose-500 to-pink-500 h-full rounded-full transition-all duration-300" 
                            style={{ width: `${(player.hp / player.maxHp) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Debuffs */}
                      <div>
                        <span className="text-xs text-slate-500 font-mono block mb-1.5">現在受けているデバフ:</span>
                        {player.debuffs.length === 0 ? (
                          <span className="text-xs text-slate-500 italic font-mono">なし</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {player.debuffs.map((d, i) => (
                              <button
                                key={i}
                                onMouseEnter={() => setHoveredDebuff(`player-${d.name}`)}
                                onMouseLeave={() => setHoveredDebuff(null)}
                                className={`text-xs px-2.5 py-1 rounded font-medium border flex items-center gap-1.5 relative transition ${
                                  d.name === "恐怖" 
                                    ? "bg-fuchsia-950/40 border-fuchsia-500/30 text-fuchsia-400" 
                                    : "bg-amber-950/40 border-amber-500/30 text-amber-400"
                                }`}
                              >
                                {d.name === "恐怖" ? <Skull className="w-3.5 h-3.5" /> : <Flame className="w-3.5 h-3.5 animate-bounce" />}
                                <span>{d.name} : {d.count}</span>
                                
                                {hoveredDebuff === `player-${d.name}` && (
                                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-slate-950 border border-slate-800 p-2 rounded shadow-2xl text-slate-300 text-[10px] leading-relaxed z-50 text-left font-sans">
                                    <p className="font-bold text-white mb-0.5">{d.name}</p>
                                    <p>{d.description}</p>
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ENEMY STATUS */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 blur-3xl rounded-full"></div>
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs bg-rose-950 text-rose-400 border border-rose-800 px-2 py-0.5 rounded font-mono font-bold">
                          ENEMY
                        </span>
                        
                        {/* Enemy Shield Status */}
                        {enemy.shield > 0 && (
                          <motion.div 
                            initial={{ scale: 0.8 }} 
                            animate={{ scale: 1 }} 
                            className="flex items-center gap-1.5 bg-blue-950 border border-blue-500/50 text-blue-300 px-2.5 py-0.5 rounded-full font-bold text-xs"
                          >
                            <Shield className="w-3.5 h-3.5 fill-blue-500/20" />
                            <span>シールド: {enemy.shield}</span>
                          </motion.div>
                        )}
                      </div>

                      <div className="flex items-baseline justify-between mb-1.5">
                        <h3 className="font-display font-bold text-xl text-white">{enemy.name}</h3>
                        
                        {/* Trait Badge (Hoverable for details) */}
                        <div className="relative">
                          <button
                            id="btn-enemy-trait"
                            onMouseEnter={() => setHoveredTrait({ name: enemy.traitName, desc: enemy.traitDescription })}
                            onMouseLeave={() => setHoveredTrait(null)}
                            className="text-xs bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 px-2 py-0.5 rounded flex items-center gap-1 font-mono font-bold"
                          >
                            <span>〈{enemy.traitName}〉</span>
                            <Info className="w-3 h-3 text-slate-400" />
                          </button>
                          
                          {hoveredTrait && (
                            <div className="absolute bottom-full right-0 mb-2 w-64 bg-slate-950 border border-slate-800 p-3 rounded-lg shadow-2xl text-slate-300 text-xs leading-relaxed z-50 text-left font-sans">
                              <p className="font-bold text-white mb-1">特性：〈{hoveredTrait.name}〉</p>
                              <p>{hoveredTrait.desc}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Health Bar */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1.5">
                          <span className="flex items-center gap-1 text-rose-400 font-bold">
                            <Heart className="w-3.5 h-3.5 fill-rose-500/20" /> HP: {enemy.hp} / {enemy.maxHp}
                          </span>
                        </div>
                        <div className="w-full bg-slate-950 h-3 rounded-full border border-slate-800 overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-red-500 to-rose-500 h-full rounded-full transition-all duration-300" 
                            style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Intent & Next action preview */}
                      <div className="mb-4 p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
                        <span className="text-[10px] text-amber-500 font-mono font-bold block mb-1">次回予告行動:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-white font-display">
                            ⚡ {enemy.nextIntent}
                          </span>
                          <span className="text-xs text-slate-400 leading-snug">
                            ({enemy.nextIntentDesc})
                          </span>
                        </div>
                      </div>

                      {/* Debuffs */}
                      <div>
                        <span className="text-xs text-slate-500 font-mono block mb-1.5">敵にかかっているデバフ:</span>
                        {enemy.debuffs.length === 0 ? (
                          <span className="text-xs text-slate-500 italic font-mono">なし</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {enemy.debuffs.map((d, i) => (
                              <button
                                key={i}
                                onMouseEnter={() => setHoveredDebuff(`enemy-${d.name}`)}
                                onMouseLeave={() => setHoveredDebuff(null)}
                                className={`text-xs px-2.5 py-1 rounded font-medium border flex items-center gap-1.5 relative transition ${
                                  d.name === "恐怖" 
                                    ? "bg-fuchsia-950/40 border-fuchsia-500/30 text-fuchsia-400" 
                                    : "bg-amber-950/40 border-amber-500/30 text-amber-400"
                                }`}
                              >
                                {d.name === "恐怖" ? <Skull className="w-3.5 h-3.5" /> : <Flame className="w-3.5 h-3.5 animate-bounce" />}
                                <span>{d.name} : {d.count}</span>
                                
                                {hoveredDebuff === `enemy-${d.name}` && (
                                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-slate-950 border border-slate-800 p-2 rounded shadow-2xl text-slate-300 text-[10px] leading-relaxed z-50 text-left font-sans">
                                    <p className="font-bold text-white mb-0.5">{d.name}</p>
                                    <p>{d.description}</p>
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* BOARD AREA & SELECTED CARD PANEL */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl relative">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <h4 className="font-display font-bold text-sm text-slate-200">フラスコ（合成準備エリア）</h4>
                      <p className="text-xs text-slate-400 leading-normal">
                        手札からカードを選択するとここに置かれます。過不足なく一致した時のみ、合成を確定できます。
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Synthesize Button */}
                      <button
                        id="btn-synthesize-action"
                        onClick={handleSynthesize}
                        disabled={!matchedCompound || !isPlayerTurn}
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition duration-200 ${
                          matchedCompound && isPlayerTurn
                            ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400 glow-blue cursor-pointer"
                            : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                        }`}
                      >
                        <Beaker className="w-4 h-4" />
                        <span>合成確定する</span>
                      </button>

                      {/* Turn End Button */}
                      <button
                        id="btn-end-turn-action"
                        onClick={endPlayerTurn}
                        disabled={!isPlayerTurn}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition duration-200 ${
                          isPlayerTurn
                            ? "bg-amber-500/10 border-amber-500/50 hover:bg-amber-500/20 text-amber-400 cursor-pointer"
                            : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed"
                        }`}
                      >
                        <span>ターン終了</span>
                      </button>
                    </div>
                  </div>

                  {/* FLASK ITEMS AREA */}
                  <div className="min-h-[100px] bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-wrap items-center justify-center gap-3 relative">
                    {selectedCardIds.length === 0 ? (
                      <span className="text-xs text-slate-500 italic">手札から元素カードを選択してください...</span>
                    ) : (
                      <div className="flex flex-wrap gap-2.5">
                        {selectedCardIds.map(id => {
                          const card = hand.find(c => c.id === id);
                          if (!card) return null;
                          return (
                            <motion.div
                              key={id}
                              layoutId={`card-flask-${id}`}
                              className={`w-14 h-20 rounded-lg border-2 flex flex-col justify-between p-2 font-display ${card.bgClass} ${card.borderClass}`}
                            >
                              <div className="flex justify-between items-start">
                                <span className="text-[10px] text-slate-500 font-mono">Flask</span>
                                <span className={`text-xs font-bold ${card.textColor}`}>{card.type}</span>
                              </div>
                              <span className="text-[9px] font-mono leading-none truncate text-center text-slate-400">
                                {card.name}
                              </span>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}

                    {/* MATCHED RESULT PREVIEW */}
                    {matchedCompound && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute bottom-2 right-3 bg-cyan-950/90 border border-cyan-500/40 px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 glow-blue"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                        <span className="text-slate-200 font-mono font-bold">
                          {matchedCompound.name} ({matchedCompound.formula}) に完全一致！
                        </span>
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* HAND AREA */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-xs text-slate-400 font-mono font-bold">
                      手札 ({hand.length} / 6 枚)
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      ※カードをクリック/タップして合成選択
                    </span>
                  </div>

                  <div className="min-h-[140px] bg-slate-950/40 border border-slate-900 rounded-2xl p-4 flex items-center justify-center gap-3 overflow-x-auto">
                    {hand.length === 0 ? (
                      <span className="text-xs text-slate-500 italic font-mono">手札はありません。ターン終了を押してください。</span>
                    ) : (
                      <div className="flex gap-3 px-2 py-1">
                        {hand.map((card) => {
                          const isSelected = selectedCardIds.includes(card.id);
                          return (
                            <motion.button
                              id={`card-${card.id}`}
                              key={card.id}
                              onClick={() => toggleCardSelection(card.id)}
                              disabled={!isPlayerTurn}
                              className={`w-20 h-28 rounded-xl border-2 flex flex-col justify-between p-2.5 text-left transition duration-200 relative group select-none ${
                                card.bgClass
                              } ${
                                isSelected 
                                  ? `${card.borderClass} ${card.glowClass} -translate-y-3` 
                                  : "border-slate-800 hover:border-slate-700 hover:-translate-y-1"
                              } ${!isPlayerTurn ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className={`text-sm font-bold font-display ${card.textColor}`}>{card.type}</span>
                                {isSelected && (
                                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></div>
                                )}
                              </div>

                              <div className="flex flex-col">
                                <span className="text-[10px] font-semibold text-slate-200">{card.name}</span>
                                <span className="text-[8px] text-slate-500 font-mono">Mass: {card.type === "H" ? 1 : card.type === "C" ? 12 : card.type === "N" ? 14 : 16}</span>
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* CARD PILE COUNTERS (Deck and Grave) */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Deck Count */}
                  <button
                    id="btn-view-deck"
                    onClick={() => setViewingPile(viewingPile === "deck" ? null : "deck")}
                    className="p-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-between transition group text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-slate-800 rounded-lg group-hover:bg-slate-750 transition">
                        <Beaker className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-300 font-display">山札</p>
                        <p className="text-[10px] text-slate-500 font-mono">クリックして中身を確認</p>
                      </div>
                    </div>
                    <span className="text-lg font-mono font-bold text-cyan-400 px-3 py-1 bg-slate-950 rounded-lg border border-slate-800">
                      {deck.length}
                    </span>
                  </button>

                  {/* Grave Count */}
                  <button
                    id="btn-view-grave"
                    onClick={() => setViewingPile(viewingPile === "grave" ? null : "grave")}
                    className="p-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-between transition group text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-slate-800 rounded-lg group-hover:bg-slate-750 transition">
                        <RotateCcw className="w-4 h-4 text-rose-400" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-300 font-display">墓地</p>
                        <p className="text-[10px] text-slate-500 font-mono">クリックして中身を確認</p>
                      </div>
                    </div>
                    <span className="text-lg font-mono font-bold text-rose-400 px-3 py-1 bg-slate-950 rounded-lg border border-slate-800">
                      {grave.length}
                    </span>
                  </button>
                </div>

              </div>

              {/* RIGHT SIDE: BATTLE LOG (1 col) */}
              <div className="lg:col-span-1 flex flex-col gap-4 self-stretch">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex-1 flex flex-col min-h-[400px]">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                    <span className="font-display font-bold text-sm text-slate-200 flex items-center gap-1.5">
                      <Swords className="w-4 h-4 text-cyan-400" />
                      戦闘ログ
                    </span>
                    <button 
                      onClick={() => setLogs([])}
                      className="text-[10px] text-slate-500 hover:text-slate-300 underline font-mono"
                    >
                      クリア
                    </button>
                  </div>

                  {/* Log stream */}
                  <div className="flex-1 overflow-y-auto max-h-[500px] flex flex-col gap-2 pr-1 text-xs font-mono">
                    {logs.length === 0 ? (
                      <div className="text-slate-600 italic text-center py-12">戦闘の軌跡がここに記録されます...</div>
                    ) : (
                      logs.map((log, index) => {
                        let textClass = "text-slate-300";
                        if (log.includes("【合成成功】")) textClass = "text-cyan-400 font-bold border-l-2 border-cyan-400 pl-1.5 py-0.5 bg-cyan-950/20";
                        else if (log.includes("【山札再構築】")) textClass = "text-amber-400 bg-amber-950/10 py-0.5 border-l-2 border-amber-500 pl-1.5";
                        else if (log.includes("スライム") || log.includes("バット") || log.includes("ゴースト")) textClass = "text-rose-300";
                        else if (log.includes("【毒ダメージ】")) textClass = "text-amber-500 font-semibold";
                        else if (log.includes("合成成功") || log.includes("効果：")) textClass = "text-green-300";

                        return (
                          <div key={index} className={`leading-normal ${textClass} break-all`}>
                            {log}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* RECIPES TAB (VIEW RECIPES 図鑑) */}
          {activeTab === "recipes" && (
            <motion.div 
              key="recipes-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-6"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="font-display font-bold text-xl text-white flex items-center gap-2">
                    <BookOpen className="w-5.5 h-5.5 text-cyan-400" />
                    化合物レシピ図鑑（全51種抜粋）
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-normal">
                    本作に登場する化合物とその比率、そしてテストプレイ版で有効化されている効果の一覧です。
                  </p>
                </div>
                <button
                  id="btn-close-recipes"
                  onClick={() => setActiveTab("battle")}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition"
                >
                  バトルに戻る
                </button>
              </div>

              {/* CARD EXPLANATIONS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-sky-950/30 border border-sky-500/20 rounded-xl">
                  <span className="text-xs font-bold font-display text-sky-400">H (水素)</span>
                  <p className="text-[11px] text-slate-400 leading-normal mt-1">初期元素。最も軽く豊富。水や過酸化水素などの基本ベースを構成。</p>
                </div>
                <div className="p-3 bg-rose-950/30 border border-rose-500/20 rounded-xl">
                  <span className="text-xs font-bold font-display text-rose-400">O (酸素)</span>
                  <p className="text-[11px] text-slate-400 leading-normal mt-1">初期元素。激しい酸化力を持ち、二酸化炭素や窒素化合物でシールドや強力なデバフを誘発。</p>
                </div>
                <div className="p-3 bg-slate-950/40 border border-slate-500/20 rounded-xl">
                  <span className="text-xs font-bold font-display text-slate-300">C (炭素)</span>
                  <p className="text-[11px] text-slate-400 leading-normal mt-1">初期元素。骨格を担う。主に毒素をまとった炭酸化合物の核となる。</p>
                </div>
                <div className="p-3 bg-purple-950/30 border border-purple-500/20 rounded-xl">
                  <span className="text-xs font-bold font-display text-purple-400">N (窒素)</span>
                  <p className="text-[11px] text-slate-400 leading-normal mt-1">初期元素。非常に安定だが化合物は極めて有毒、または頑強。シールドやアンモニア毒のベース。</p>
                </div>
              </div>

              {/* RECIPE LIST */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {RECIPES.map((recipe, index) => (
                  <div 
                    key={index}
                    className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                      recipe.implemented 
                        ? "bg-slate-950/80 border-cyan-500/30 glow-blue hover:border-cyan-500/50" 
                        : "bg-slate-950/30 border-slate-800 opacity-60"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-display font-bold text-sm text-white flex items-center gap-1.5">
                          {recipe.name}
                          {recipe.implemented && (
                            <span className="text-[9px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-1.5 py-0.2 rounded font-mono font-bold">
                              テスト稼働中
                            </span>
                          )}
                        </span>
                        <span className="text-xs font-mono text-cyan-400 font-bold bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                          {recipe.formulaDisplay}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                        {recipe.description}
                      </p>
                    </div>

                    {recipe.implemented && recipe.testPlayEffect && (
                      <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-green-400 whitespace-pre-line">
                        <span className="text-[10px] text-slate-500 font-bold block mb-0.5 font-sans">【テストプレイ時効果】</span>
                        {recipe.testPlayEffect}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* VICTORY SCREEN */}
          {gameState === "victory" && (
            <motion.div 
              key="victory-screen"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center max-w-md mx-auto"
            >
              <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-full mb-6 shadow-[0_0_30px_rgba(6,182,212,0.15)] animate-bounce">
                <CheckCircle className="w-14 h-14 text-cyan-400" />
              </div>
              
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-2">戦闘勝利！</h2>
              <p className="text-sm text-slate-400 mb-8 leading-relaxed">
                化学的な連鎖合成と、過不足のない完璧な元素比率の計算により、見事エネミーの撃破に成功しました！
              </p>

              <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 text-left font-mono text-xs">
                <h4 className="font-bold text-slate-300 border-b border-slate-800 pb-2 mb-2 font-display">戦闘最終ステータス</h4>
                <p className="flex justify-between py-1">
                  <span>プレイヤー残り体力:</span>
                  <span className="text-cyan-400 font-bold">{player.hp} / {player.maxHp}</span>
                </p>
                <p className="flex justify-between py-1">
                  <span>生存ターン数:</span>
                  <span className="text-slate-300 font-bold">{turn} ターン</span>
                </p>
              </div>

              <div className="flex flex-col gap-3 w-full">
                {currentNodeId ? (
                  // ダンジョン中の場合
                  dungeonMap.find(n => n.id === currentNodeId)?.depth === 5 ? (
                    // 5マス目（ボス）の場合
                    <button
                      id="btn-victory-to-clear"
                      onClick={() => setGameState("game_clear")}
                      className="w-full py-3 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg transition duration-200 cursor-pointer"
                    >
                      👑 実験室から脱出し、ゲームクリアへ！
                    </button>
                  ) : (
                    // 通常のマスの場合
                    <button
                      id="btn-victory-to-map"
                      onClick={() => {
                        setGameState("dungeon_map");
                        setEnemy(null);
                      }}
                      className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg transition duration-200 cursor-pointer"
                    >
                      ダンジョンマップに戻る
                    </button>
                  )
                ) : (
                  // 個別戦闘テストの場合
                  <button
                    id="btn-victory-continue"
                    onClick={returnToTitle}
                    className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg transition duration-200 cursor-pointer"
                  >
                    他の敵を戦闘テストする
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* GAMEOVER SCREEN */}
          {gameState === "gameover" && (
            <motion.div 
              key="gameover-screen"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center max-w-md mx-auto"
            >
              <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-full mb-6 animate-pulse">
                <Skull className="w-14 h-14 text-rose-500" />
              </div>
              
              <h2 className="text-2xl md:text-3xl font-display font-bold text-rose-500 mb-2">戦闘実験失敗 (GAME OVER)</h2>
              <p className="text-sm text-slate-400 mb-8 leading-relaxed">
                元素の合成比率を間違えたか、それともデバフの管理を誤ったかもしれません。化学は常に挑戦と試行錯誤の連続です。
              </p>

              <div className="flex flex-col gap-3 w-full">
                {currentNodeId ? (
                  <button
                    id="btn-gameover-to-title"
                    onClick={() => {
                      setGameState("title");
                      setEnemy(null);
                    }}
                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-sm rounded-xl transition duration-200 cursor-pointer"
                  >
                    タイトルに戻る (ダンジョン挑戦終了)
                  </button>
                ) : (
                  <button
                    id="btn-gameover-retry"
                    onClick={returnToTitle}
                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-sm rounded-xl transition duration-200 cursor-pointer"
                  >
                    敵の選択に戻り、再実験する
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* DUNGEON MAP SCREEN */}
          {gameState === "dungeon_map" && (
            <motion.div 
              key="dungeon-map-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col gap-6 max-w-3xl mx-auto w-full py-6"
            >
              <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl flex flex-col gap-4 shadow-xl">
                <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2 font-display">
                      <Sparkles className="text-cyan-400 w-5 h-5" />
                      元素研究室の廃墟 (Dungeon Stage 1)
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      化学実験器具や素材が眠る遺跡です。奥行き5層の試作ルートを進み、最深部のボスを目指してください。
                    </p>
                  </div>
                  <button 
                    onClick={returnToTitle}
                    className="text-xs bg-slate-800 hover:bg-slate-750 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 cursor-pointer"
                  >
                    諦めてリタイア
                  </button>
                </div>

                {/* 2Dルートマップ風 UI */}
                <div className="py-8 px-4 flex flex-col gap-6 bg-slate-950/50 rounded-xl border border-slate-900 relative">
                  {/* 深さ 1 から 5 までをループ */}
                  {[1, 2, 3, 4, 5].map(depth => {
                    const nodesInDepth = dungeonMap.filter(n => n.depth === depth);
                    return (
                      <div key={depth} className="flex flex-col gap-3">
                        <div className="flex justify-between items-center text-[10px] font-mono text-slate-600 border-b border-slate-900 pb-1.5">
                          <span>DEPTH 0{depth}</span>
                          {depth === 5 && <span className="text-amber-500 font-bold flex items-center gap-1">👑 FINAL BOSS</span>}
                        </div>
                        <div className="flex justify-around items-center py-2 gap-4">
                          {nodesInDepth.map(node => {
                            // 選択可能かの判定
                            let canSelect = false;
                            if (depth === 1 && !currentNodeId) {
                              canSelect = true; // 最初のマス
                            } else if (currentNodeId) {
                              const currentNode = dungeonMap.find(n => n.id === currentNodeId);
                              if (currentNode && isNodeConnected(currentNode, node) && currentNode.completed) {
                                canSelect = true; // 現在のマスが完了していて、道がつながっている
                              }
                            }

                            const isCurrent = node.id === currentNodeId;
                            
                            // アイコンと背景クラスの設定
                            let icon = "⚔️";
                            let typeText = "戦闘";
                            let styleClass = "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700";

                            if (node.type === "shop") {
                              icon = "🪙";
                              typeText = "ショップ";
                              styleClass = "bg-amber-950/10 border-amber-500/20 text-amber-400 hover:border-amber-400/50";
                            } else if (node.type === "event") {
                              icon = "💎";
                              typeText = "イベント";
                              styleClass = "bg-purple-950/10 border-purple-500/20 text-purple-400 hover:border-purple-400/50";
                            } else if (depth === 5) {
                              icon = "👹";
                              typeText = "BOSS";
                              styleClass = "bg-rose-950/20 border-rose-500/30 text-rose-400 hover:border-rose-500";
                            }

                            if (node.completed) {
                              styleClass = "bg-slate-950 border-slate-850 text-slate-600 line-through opacity-50";
                            } else if (isCurrent) {
                              styleClass = "bg-cyan-950/30 border-cyan-400 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]";
                            } else if (canSelect) {
                              styleClass = "bg-slate-900 border-cyan-500/40 text-cyan-400 hover:border-cyan-400 cursor-pointer animate-pulse";
                            }

                            return (
                              <button
                                key={node.id}
                                disabled={!canSelect}
                                onClick={() => {
                                  if (node.type === "battle") {
                                    // 敵をランダムに選択（スライム, バット, ゴースト）
                                    const enemies: ("slime" | "bat" | "ghost")[] = ["slime", "bat", "ghost"];
                                    const randEnemy = enemies[Math.floor(Math.random() * enemies.length)];
                                    setCurrentNodeId(node.id);
                                    startBattle(randEnemy, depth === 5); // 5層目ならボス
                                  } else if (node.type === "shop") {
                                    enterShopNode(node.id);
                                  } else {
                                    enterEventNode(node.id);
                                  }
                                }}
                                className={`flex-1 p-3 border rounded-xl flex flex-col items-center gap-1 text-center transition duration-200 ${styleClass}`}
                              >
                                <span className="text-lg">{icon}</span>
                                <span className="text-xs font-bold font-display">{typeText}</span>
                                {node.completed && <span className="text-[9px] text-green-500 font-bold">済</span>}
                                {isCurrent && !node.completed && <span className="text-[9px] text-cyan-400 font-bold">現在地</span>}
                                {canSelect && !node.completed && <span className="text-[9px] text-cyan-300 font-bold">進行可能</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-slate-950/30 p-4 rounded-xl border border-slate-900 text-xs text-slate-400 leading-relaxed font-sans">
                  <strong>💡 進行方法:</strong> 「進行可能」と点滅している一番下のノード（深さ1）をクリックして開始します。クリアすると接続されている上の層のマスへ進むことができます。最上層の5マス目は最大HPが2倍になった強力なBOSSが立ちはだかります！
                </div>
              </div>
            </motion.div>
          )}

          {/* SHOP SCREEN */}
          {gameState === "shop" && (
            <motion.div 
              key="shop-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col gap-6 max-w-4xl mx-auto w-full py-6"
            >
              <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl flex flex-col gap-6 shadow-xl">
                <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-xl font-bold text-amber-400 flex items-center gap-2 font-display">
                      🪙 闇の化学品闇市（Shop）
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      集めたゴールドを支払って、元素の購入、実験器具の調達、体力の回復、さらには手札の上限突破を行うことができます。
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      // ショップマスを完了にしてマップに戻る
                      if (currentNodeId) {
                        setDungeonMap(prev => prev.map(node => {
                          if (node.id === currentNodeId) {
                            return { ...node, completed: true };
                          }
                          return node;
                        }));
                      }
                      setGameState("dungeon_map");
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    買い物終了（ダンジョンマップへ）
                  </button>
                </div>

                {/* SHOP ITEMS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left: Cards and Artifacts */}
                  <div className="flex flex-col gap-4">
                    <h4 className="text-xs font-mono font-bold text-slate-400 tracking-wider">元素カード（デッキに恒久追加）</h4>
                    <div className="grid grid-cols-1 gap-2.5">
                      {shopCards.map(sc => (
                        <div key={sc.id} className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-cyan-400 text-lg font-mono">
                              {sc.type}
                            </span>
                            <div>
                              <p className="text-xs font-bold text-white">{ELEMENT_DEFS[sc.type].name}</p>
                              <p className="text-[10px] text-slate-500">初期デッキの構築を補強するための元素</p>
                            </div>
                          </div>
                          <button
                            disabled={gold < sc.price}
                            onClick={() => handleBuyCard(sc.type, sc.price, sc.id)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                              gold >= sc.price
                                ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                                : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                            }`}
                          >
                            🪙 {sc.price} G
                          </button>
                        </div>
                      ))}
                      {shopCards.length === 0 && (
                        <p className="text-xs text-slate-600 italic py-4 text-center">売り切れました。</p>
                      )}
                    </div>

                    <h4 className="text-xs font-mono font-bold text-slate-400 tracking-wider mt-2">実験器具（特殊アイテム）</h4>
                    <div className="grid grid-cols-1 gap-2.5">
                      {shopArtifacts.map(sa => {
                        let desc = "";
                        if (sa.name === "丸底フラスコ") desc = "ターン開始時に引く上限が+1枚増加する。";
                        else if (sa.name === "割れたフラスコ") desc = "【即時】デッキからカードを5枚選んで消滅させる。ターン開始ドローが-1。";
                        else if (sa.name === "水道水") desc = "1ターン目の開始時、H（水素）を1枚手札に生成する。";

                        return (
                          <div key={sa.id} className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl flex items-center justify-between">
                            <div className="flex-1 pr-4">
                              <p className="text-xs font-bold text-cyan-300 flex items-center gap-1">🧪 {sa.name}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{desc}</p>
                            </div>
                            <button
                              disabled={gold < sa.price}
                              onClick={() => handleBuyArtifact(sa.name, sa.price, sa.id)}
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                                gold >= sa.price
                                  ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                                  : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                              }`}
                            >
                              🪙 {sa.price} G
                            </button>
                          </div>
                        );
                      })}
                      {shopArtifacts.length === 0 && (
                        <p className="text-xs text-slate-600 italic py-4 text-center">売り切れ、またはすべて所持しています。</p>
                      )}
                    </div>
                  </div>

                  {/* Right: Player Upgrades (Heal, Max HP, Hand Limit) */}
                  <div className="flex flex-col gap-4 bg-slate-950/40 p-5 rounded-2xl border border-slate-850">
                    <h4 className="text-xs font-mono font-bold text-slate-400 tracking-wider">プレイヤー・インフラ設備強化</h4>
                    
                    {/* Heal */}
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-rose-400">体力の応急修復（回復）</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">体力を 10 ポイント回復します。</p>
                      </div>
                      <button
                        disabled={gold < shopHealPrice || player.hp >= player.maxHp}
                        onClick={() => handleBuyHeal(shopHealPrice)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                          gold >= shopHealPrice && player.hp < player.maxHp
                            ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                            : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                        }`}
                      >
                        🪙 {shopHealPrice} G
                      </button>
                    </div>

                    {/* Max HP Increase */}
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-rose-300">実験室セキュリティ強化（最大HP増加）</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">最大体力を +5 増加させ、HPも 5 回復します。</p>
                      </div>
                      <button
                        disabled={gold < shopMaxHpPrice}
                        onClick={() => handleBuyMaxHp(shopMaxHpPrice)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                          gold >= shopMaxHpPrice
                            ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                            : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                        }`}
                      >
                        🪙 {shopMaxHpPrice} G
                      </button>
                    </div>

                    {/* Hand Limit Increase */}
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-cyan-400">ドラフト回路拡張（手札上限増加）</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          手札上限を+1増やします。最大4回まで。（現在: {handLimitUpgradeCount}/4回）
                        </p>
                      </div>
                      {handLimitUpgradeCount >= 4 ? (
                        <span className="text-xs text-green-500 font-bold px-3 py-1.5 bg-slate-950 rounded-lg border border-slate-800">MAX</span>
                      ) : (
                        <button
                          disabled={gold < [100, 200, 400, 800][handLimitUpgradeCount]}
                          onClick={handleBuyHandLimit}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                            gold >= [100, 200, 400, 800][handLimitUpgradeCount]
                              ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                              : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                          }`}
                        >
                          🪙 {[100, 200, 400, 800][handLimitUpgradeCount]} G
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* EVENT SCREEN */}
          {gameState === "event" && activeEvent && (
            <motion.div 
              key="event-screen"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center max-w-lg mx-auto"
            >
              <div className="bg-slate-900/90 border border-slate-800 p-8 rounded-2xl flex flex-col items-center gap-6 shadow-2xl relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-purple-500 to-indigo-500"></div>
                
                <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-full">
                  <Sparkles className="w-12 h-12 text-purple-400 animate-pulse" />
                </div>

                <h3 className="text-xl font-bold text-white font-display">未知の遭遇 (Event Node)</h3>
                
                <p className="text-sm text-slate-300 leading-relaxed font-sans px-2">
                  {activeEvent.description}
                </p>

                {/* 獲得成果のハイライト */}
                <div className="w-full bg-slate-950/60 border border-slate-850 p-4 rounded-xl flex items-center justify-between text-left font-mono">
                  <span className="text-xs text-slate-500 font-sans">獲得結果:</span>
                  {activeEvent.type === "heal" && (
                    <span className="text-sm text-rose-400 font-bold flex items-center gap-1">
                      💚 プレイヤーの体力回復 (+{activeEvent.value})
                    </span>
                  )}
                  {activeEvent.type === "gold" && (
                    <span className="text-sm text-amber-400 font-bold flex items-center gap-1">
                      🪙 ゴールド獲得 (+{activeEvent.value} G)
                    </span>
                  )}
                  {activeEvent.type === "card" && (
                    <span className="text-sm text-cyan-400 font-bold flex items-center gap-1">
                      🎴 元素カード「{activeEvent.value}」をデッキへ追加
                    </span>
                  )}
                </div>

                <button
                  id="btn-event-continue"
                  onClick={() => {
                    setGameState("dungeon_map");
                    setActiveEvent(null);
                  }}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm rounded-xl transition duration-200 shadow-md cursor-pointer"
                >
                  探索を続ける（ダンジョンマップに戻る）
                </button>
              </div>
            </motion.div>
          )}

          {/* GAME CLEAR SCREEN */}
          {gameState === "game_clear" && (
            <motion.div 
              key="game-clear-screen"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center max-w-md mx-auto"
            >
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-full mb-6 shadow-[0_0_30px_rgba(245,158,11,0.2)] animate-bounce">
                <Sparkles className="w-14 h-14 text-amber-400" />
              </div>
              
              <h2 className="text-2xl md:text-3xl font-display font-bold text-amber-400 mb-2">🏆 ダンジョンクリア！ 🏆</h2>
              <p className="text-sm text-slate-400 mb-8 leading-relaxed">
                研究室最深部のBOSSを見事に化学反応の力で圧倒しました！化学を愛する凄腕のプレイヤーとして、ここにテストプレイの終了を讃えます。
              </p>

              <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 text-left font-mono text-xs flex flex-col gap-2">
                <h4 className="font-bold text-slate-300 border-b border-slate-800 pb-2 mb-1 font-display">最終冒険リザルト</h4>
                <p className="flex justify-between py-0.5">
                  <span>プレイヤー生存HP:</span>
                  <span className="text-rose-400 font-bold">{player.hp} / {player.maxHp}</span>
                </p>
                <p className="flex justify-between py-0.5">
                  <span>所持ゴールド:</span>
                  <span className="text-amber-400 font-bold">{gold} G</span>
                </p>
                <p className="flex justify-between py-0.5">
                  <span>最終手札上限:</span>
                  <span className="text-cyan-400 font-bold">{handLimit} 枚</span>
                </p>
                <p className="flex justify-between py-0.5">
                  <span>獲得実験器具:</span>
                  <span className="text-slate-300 font-bold">{ownedArtifacts.length > 0 ? ownedArtifacts.join(", ") : "なし"}</span>
                </p>
                <p className="flex justify-between py-0.5">
                  <span>デッキ内総カード数:</span>
                  <span className="text-slate-300 font-bold">{globalDeck.length} 枚</span>
                </p>
              </div>

              <div className="flex flex-col gap-3 w-full">
                <button
                  id="btn-clear-return"
                  onClick={returnToTitle}
                  className="w-full py-3 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-bold text-sm rounded-xl transition duration-200 cursor-pointer"
                >
                  タイトル画面に戻る
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* PILE LIST DIALOG (MODAL) */}
      <AnimatePresence>
        {viewingPile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                <h4 className="font-display font-bold text-base text-white">
                  {viewingPile === "deck" ? `山札カード一覧 (${deck.length} 枚)` : `墓地カード一覧 (${grave.length} 枚)`}
                </h4>
                <button 
                  onClick={() => setViewingPile(null)}
                  className="text-xs bg-slate-800 hover:bg-slate-750 px-2.5 py-1 rounded border border-slate-700 text-slate-400 hover:text-white transition"
                >
                  閉じる
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1 bg-slate-950/30">
                <p className="text-xs text-slate-500 mb-3 italic">
                  {viewingPile === "deck" 
                    ? "※山札の中身です。シャッフルされているため、戦闘中はランダムな順序で引かれます。" 
                    : "※使用された、あるいは手札破棄されたカードがここに置かれます。山札が空になると再シャッフルされます。"}
                </p>

                {((viewingPile === "deck" ? deck : grave).length === 0) ? (
                  <p className="text-xs text-slate-500 text-center py-8">カードはありません。</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2.5">
                    {(viewingPile === "deck" ? deck : grave).map((card, i) => (
                      <div 
                        key={i}
                        className={`p-2 rounded-lg border flex flex-col justify-between items-center text-center font-display ${card.bgClass} ${card.borderClass} ${card.glowClass}`}
                      >
                        <span className={`text-sm font-bold ${card.textColor}`}>{card.type}</span>
                        <span className="text-[8px] text-slate-400 font-mono mt-0.5">{card.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GRAVE SALVAGE DIALOG (MODAL) */}
      <AnimatePresence>
        {showGraveSalvage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                <h4 className="font-display font-bold text-base text-white">
                  墓地回収（サルベージ） - 残り {salvageCount} 枚
                </h4>
                <button 
                  onClick={() => cleanupAfterSalvage(tempEffectZone)}
                  className="text-xs bg-rose-950/40 hover:bg-rose-900 px-2.5 py-1 rounded border border-rose-800 text-rose-300 transition"
                >
                  回収をキャンセル
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1 bg-slate-950/30">
                <p className="text-xs text-slate-400 mb-4 font-sans">
                  墓地から好きなカードを選択して手札に加えることができます。現在の化合物による残り回収枠は <strong>{salvageCount} 枚</strong> です。
                </p>

                {grave.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">墓地にカードはありません。</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2.5">
                    {grave.map((card, i) => (
                      <button 
                        key={card.id + "-" + i}
                        onClick={() => handleSalvageCard(card.id)}
                        className={`p-2.5 rounded-lg border flex flex-col justify-between items-center text-center font-display hover:scale-105 active:scale-95 transition cursor-pointer ${card.bgClass} ${card.borderClass} ${card.glowClass}`}
                      >
                        <span className={`text-base font-bold ${card.textColor}`}>{card.type}</span>
                        <span className="text-[9px] text-slate-300 font-sans mt-1 leading-tight">{card.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BROKEN FLASK PURGE DIALOG (MODAL) */}
      <AnimatePresence>
        {showPurgeModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-red-500/30 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-[0_0_50px_rgba(239,68,68,0.15)] overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                <div>
                  <h4 className="font-display font-bold text-base text-red-400 flex items-center gap-2">
                    🧪 割れたフラスコ：負のエネルギー（カード5枚の消滅）
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    デッキから永久に消滅（削除）させる元素カードを正確に 5 枚選んでください。
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-red-400 bg-red-950/30 border border-red-900/50 px-2.5 py-1 rounded-lg">
                  選択中: {purgeSelectedCardIds.length} / 5 枚
                </span>
              </div>

              <div className="p-5 overflow-y-auto flex-1 bg-slate-950/30">
                <div className="grid grid-cols-4 gap-2.5">
                  {globalDeck.map((card) => {
                    const isSelected = purgeSelectedCardIds.includes(card.id);
                    return (
                      <button 
                        key={card.id}
                        onClick={() => {
                          if (isSelected) {
                            setPurgeSelectedCardIds(prev => prev.filter(id => id !== card.id));
                          } else {
                            if (purgeSelectedCardIds.length >= 5) return;
                            setPurgeSelectedCardIds(prev => [...prev, card.id]);
                          }
                        }}
                        className={`p-2.5 rounded-lg border flex flex-col justify-between items-center text-center font-display hover:scale-105 active:scale-95 transition cursor-pointer relative ${card.bgClass} ${
                          isSelected 
                            ? "border-red-500 ring-2 ring-red-500/50 bg-red-950/20" 
                            : card.borderClass
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 text-[8px] font-bold w-4 h-4 flex items-center justify-center shadow-md">
                            ✕
                          </div>
                        )}
                        <span className={`text-base font-bold ${isSelected ? "text-red-400" : card.textColor}`}>{card.type}</span>
                        <span className="text-[8px] text-slate-400 font-mono mt-1 leading-tight">{card.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 border-t border-slate-800 bg-slate-950 flex gap-3">
                <button
                  disabled={purgeSelectedCardIds.length !== 5}
                  onClick={handlePurgeComplete}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition cursor-pointer ${
                    purgeSelectedCardIds.length === 5
                      ? "bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-950/50"
                      : "bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  選択した5枚を消滅させ、実験器具を入手する
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <footer className="border-t border-slate-800 bg-slate-950/40 py-4 px-6 text-center text-xs text-slate-500 font-mono">
        元素ローグライクカードゲーム仕様書連携プロジェクト &copy; 2026. All rights reserved.
      </footer>
    </div>
  );
}
