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
    testPlayEffect: "敵に3ダメージを与える。自身に3のシールドを付与し、カードを1枚引く。",
    implemented: true
  },
  {
    name: "アンモニア",
    formula: "NH3",
    formulaDisplay: (<span>NH<sub>3</sub></span>),
    elements: { N: 1, H: 3 },
    description: "刺激臭のある気体。他の化合物と組み合わせることで真価を発揮する毒素の触媒。",
    testPlayEffect: "敵に4ダメージを与える。このターンにすでに水（H2O）を合成していたなら、対象に「毒デバフ（カウント+3）」を付与する。",
    implemented: true
  },
  {
    name: "一酸化炭素",
    formula: "CO",
    formulaDisplay: (<span>CO</span>),
    elements: { C: 1, O: 1 },
    description: "無色無臭だが極めて有害な気体。相手に静かに浸透し、継続的なダメージを付与する。",
    testPlayEffect: "敵に「毒デバフ」（カウント1）を付与し、カードを1枚引く。",
    implemented: true
  },
  {
    name: "二酸化炭素",
    formula: "CO2",
    formulaDisplay: (<span>CO<sub>2</sub></span>),
    elements: { C: 1, O: 2 },
    description: "温暖化を招くガス。窒息性の衝撃と同時に、対象に強力な毒素を流し込む。",
    testPlayEffect: "敵に4ダメージを与え、さらに「毒デバフ」（カウント1）を付与する。",
    implemented: true
  },
  {
    name: "一酸化窒素",
    formula: "NO",
    formulaDisplay: (<span>NO</span>),
    elements: { N: 1, O: 1 },
    description: "血管拡張などの生理活性を持つ。危険から身を守るためのシールドを展開する。",
    testPlayEffect: "自分に2のシールドを付与する。さらに墓地から好きなカードを1枚選び手札に加える。",
    implemented: true
  },
  {
    name: "二酸化窒素",
    formula: "NO2",
    formulaDisplay: (<span>NO<sub>2</sub></span>),
    elements: { N: 1, O: 2 },
    description: "赤褐色の有毒な気体。非常に強力なシールドを貼るが、反動で自身も毒に侵される。",
    testPlayEffect: "自分に5のシールドを付与する。さらに墓地から好きなカードを1枚選び手札に加える。",
    implemented: true
  },
  {
    name: "過酸化水素",
    formula: "H2O2",
    formulaDisplay: (<span>H<sub>2</sub>O<sub>2</sub></span>),
    elements: { H: 2, O: 2 },
    description: "漂白剤や消毒剤として使われる。激しい酸化力で敵を蝕みつつ、自身を保護するシールドを生成する。",
    testPlayEffect: "敵に2ダメージを与える。自身に3のシールドを付与し、墓地の水素（H）カードをすべて山札に戻す。",
    implemented: true
  },
  // 未実装レシピのプレースホルダー（図鑑に51種の一部として表記）
  { name: "炭酸", formula: "H2CO3", formulaDisplay: (<span>H<sub>2</sub>CO<sub>3</sub></span>), elements: { H: 2, C: 1, O: 3 }, description: "爽快な気泡。効果は今後実装予定。", implemented: false },
  { name: "シュウ酸", formula: "H2C2O4", formulaDisplay: (<span>H<sub>2</sub>C<sub>2</sub>O<sub>4</sub></span>), elements: { H: 2, C: 2, O: 4 }, description: "植物に含まれる酸。効果は今後実装予定。", implemented: false },
  { name: "酢酸", formula: "CH3COOH", formulaDisplay: (<span>CH<sub>3</sub>COOH</span>), elements: { C: 2, H: 4, O: 2 }, description: "酸味の主成分。手札上限拡張が必要なレシピ。", implemented: false },
  { name: "硝酸", formula: "HNO3", formulaDisplay: (<span>HNO<sub>3</sub></span>), elements: { H: 1, N: 1, O: 3 }, description: "極めて強い酸性。効果は今後実装予定。", implemented: false },
  { name: "亜硝酸", formula: "HNO2", formulaDisplay: (<span>HNO<sub>2</sub></span>), elements: { H: 1, N: 1, O: 2 }, description: "不安定な一価の酸。効果は今後実装予定。", implemented: false },
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
  // --- Game State ---
  const [player, setPlayer] = useState<Player>({
    hp: 20,
    maxHp: 20,
    shield: 0,
    debuffs: []
  });

  const [enemy, setEnemy] = useState<Enemy | null>(null);
  const [gameState, setGameState] = useState<"title" | "battle" | "victory" | "gameover">("title");
  
  // デッキ・手札関連
  const [deck, setDeck] = useState<ElementCard[]>([]);
  const [hand, setHand] = useState<ElementCard[]>([]);
  const [grave, setGrave] = useState<ElementCard[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [showGraveSalvage, setShowGraveSalvage] = useState<boolean>(false);

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
  const startBattle = (enemyType: "slime" | "bat" | "ghost") => {
    // プレイヤーリセット (HPは引き継ぐため、死亡時のみ20にリセット)
    setPlayer(prev => ({
      hp: prev.hp <= 0 ? 20 : prev.hp,
      maxHp: 20,
      shield: 0,
      debuffs: []
    }));

    // 敵テンプレート作成、予告作成
    let rawEnemy = createEnemyTemplate(enemyType);
    rawEnemy = updateEnemyIntent(rawEnemy);
    setEnemy(rawEnemy);

    // デッキ初期化＆シャッフル
    const initialCards = INITIAL_DECK_TYPES.map(createCard);
    
    // フィッシャー–イェーツのシャッフル
    const shuffled = [...initialCards];
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

    // 初期ドロー6枚 (遅延実行でドローアニメーションを感じられるように)
    drawCards(shuffled, [], [], 6);
  };

  // 1枚ずつのドロー処理（再帰的/バッチ処理）
  const drawCards = (currentDeck: ElementCard[], currentHand: ElementCard[], currentGrave: ElementCard[], count: number) => {
    let d = [...currentDeck];
    let h = [...currentHand];
    let g = [...currentGrave];
    let drawnCount = 0;

    for (let i = 0; i < count; i++) {
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

  const handleSalvageCard = (cardId: string) => {
    const targetCard = grave.find(c => c.id === cardId);
    if (!targetCard) {
      setShowGraveSalvage(false);
      return;
    }
    
    // 手札に追加
    setHand(prevHand => [...prevHand, targetCard]);
    // 墓地から削除
    setGrave(prevGrave => prevGrave.filter(c => c.id !== cardId));
    
    addLog(`墓地から「${targetCard.name}」を手札に戻しました。`);
    setShowGraveSalvage(false);
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

    // プレイヤーにかかっている「恐怖」デバフチェック
    const isPlayerFeared = player.debuffs.some(d => d.name === "恐怖" && d.count > 0);

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
        compoundLog = `「一酸化窒素」の効果：自分に 2 のシールドを付与した。`;
        break;
      }
      case "二酸化窒素": {
        // 自分に5シールド、墓地から1枚選んで手札に加える（ペナルティの毒は削除）
        nextPlayer.shield += 5;
        triggerGraveSalvage = true;
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
      default:
        break;
    }

    addLog(compoundLog);

    // 使用したカードを墓地へ
    const usedCards = hand.filter(c => selectedCardIds.includes(c.id));
    const remainingHand = hand.filter(c => !selectedCardIds.includes(c.id));
    
    let updatedGrave = [...grave, ...usedCards];
    let updatedHand = remainingHand;
    let updatedDeck = [...deck];

    // 過酸化水素：墓地の水素（H）をすべて山札に戻す
    if (returnHydrogenAfter) {
      const hydrogenInGrave = updatedGrave.filter(c => c.type === "H");
      if (hydrogenInGrave.length > 0) {
        // 墓地から水素を削除
        updatedGrave = updatedGrave.filter(c => c.type !== "H");
        // 山札に追加
        updatedDeck = [...updatedDeck, ...hydrogenInGrave];
        
        // シャッフル
        for (let i = updatedDeck.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [updatedDeck[i], updatedDeck[j]] = [updatedDeck[j], updatedDeck[i]];
        }
        addLog(`【山札還流】墓地の水素（H）カード ${hydrogenInGrave.length} 枚をすべて山札に戻し、シャッフルしました。`);
      } else {
        addLog("（墓地に水素カードがなかったため、山札に戻す処理は行われませんでした）");
      }
    }

    // まずカードの移動状態を反映
    setGrave(updatedGrave);
    setHand(updatedHand);
    setSelectedCardIds([]);
    setDeck(updatedDeck);

    // 敵の死亡チェック
    if (nextEnemy.hp <= 0) {
      setEnemy(nextEnemy);
      setPlayer(nextPlayer);
      handleBattleVictory();
      return; // 勝利したらモーダル起動やドローは行わない
    } else {
      setEnemy(nextEnemy);
      setPlayer(nextPlayer);
    }

    // ドロー処理がある場合
    if (drawCountAfter > 0) {
      // タイムアウトなしで同期的に最新の状態でドロー
      drawCards(updatedDeck, updatedHand, updatedGrave, drawCountAfter);
    }

    // 墓地回収がある場合
    if (triggerGraveSalvage) {
      // 回収対象が墓地にあるか
      if (updatedGrave.length > 0) {
        setShowGraveSalvage(true);
        addLog("墓地から手札に加えるカードを1枚選んでください。");
      } else {
        addLog("（墓地が空のため、カードを回収できませんでした）");
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

    // カードを6枚ドロー
    drawCards(deckRef.current, [], graveRef.current, 6);
  };

  // 戦闘勝利処理
  const handleBattleVictory = () => {
    setGameState("victory");
    addLog("戦闘に勝利しました！おめでとうございます！");
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
            <p className="text-xs text-slate-400 font-mono hidden md:block">v1.0.0 (Slime, Bat, Ghost Combat Sandbox)</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
                テストプレイ用：カードバトルサンドボックス
              </h2>
              
              <p className="text-slate-400 text-sm md:text-base mb-8 max-w-md leading-relaxed">
                化学をテーマにした独自のローグライクカードバトルの試作版です。
                初期元素カード（H, O, C, N）を過不足なく選択して「合成確定」し、強力な化学反応を巻き起こして敵を撃破してください。
              </p>

              <div className="w-full bg-slate-900/50 border border-slate-800 rounded-xl p-5 mb-8 text-left">
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-1.5 font-display">
                  <Swords className="w-4 h-4 text-cyan-400" />
                  戦闘テスト対象の敵を選択
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    id="btn-select-slime"
                    onClick={() => startBattle("slime")}
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
                    onClick={() => startBattle("bat")}
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
                    onClick={() => startBattle("ghost")}
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
                      <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-green-400">
                        <span className="text-[10px] text-slate-500 font-bold block mb-0.5">【テストプレイ時効果】</span>
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
                <button
                  id="btn-victory-continue"
                  onClick={returnToTitle}
                  className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg transition duration-200"
                >
                  他の敵を戦闘テストする
                </button>
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
                <button
                  id="btn-gameover-retry"
                  onClick={returnToTitle}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-sm rounded-xl transition duration-200"
                >
                  敵の選択に戻り、再実験する
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
                  墓地回収（サルベージ）
                </h4>
                <button 
                  onClick={() => setShowGraveSalvage(false)}
                  className="text-xs bg-rose-950/40 hover:bg-rose-900 px-2.5 py-1 rounded border border-rose-800 text-rose-300 transition"
                >
                  回収をキャンセル
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1 bg-slate-950/30">
                <p className="text-xs text-slate-400 mb-4 font-sans">
                  墓地から好きなカードを1枚選択して手札に加えることができます。
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

      {/* FOOTER */}
      <footer className="border-t border-slate-800 bg-slate-950/40 py-4 px-6 text-center text-xs text-slate-500 font-mono">
        元素ローグライクカードゲーム仕様書連携プロジェクト &copy; 2026. All rights reserved.
      </footer>
    </div>
  );
}
