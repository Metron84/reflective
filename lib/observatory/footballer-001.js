import "server-only";

export const STUDY_SLUG = "footballer-001";
export const STUDY_VERSION = 1;
export const ORDER = ["W", "L", "P", "A", "M", "S", "G"];

export const ARCHETYPES = {
  W: { name: "The Warrior", line: "Fights for every ball. Gives everything for the badge. Never backs down." },
  L: { name: "The Leader", line: "Takes charge. Stays calm under pressure. Carries the dressing room." },
  P: { name: "The Professional", line: "Does the job every single week. Disciplined, reliable, no drama." },
  A: { name: "The Artist", line: "Plays with joy and imagination. Does things nobody else can." },
  M: { name: "The Maverick", line: "Wild, emotional, unpredictable. You never know what comes next, and that is the point." },
  S: { name: "The Servant", line: "Humble and selfless. Does the hard work nobody sees, for the team." },
  G: { name: "The Gentle One", line: "Kind, warm and open. Easy to like first, ruthless second." },
};

export const QUESTIONS = {
  q1: { text: "When you watch your team, what matters most to you?", options: [
    { id: "q1_win", text: "Winning. Whatever it takes.", points: { W: 1, L: 1, P: 1 }, go: "win" },
    { id: "q1_entertain", text: "Being entertained. I want to enjoy it.", points: { A: 1, M: 1 }, go: "entertain" },
    { id: "q1_connect", text: "Being proud of the players as people.", points: { S: 1, G: 1 }, go: "connect" },
  ] },
  win1: { text: "You are losing 1-0 with 10 minutes left. What do you want from your best player?", options: [
    { id: "win1_a", text: "Get stuck in. Win every tackle and fire everyone up.", points: { W: 2 } },
    { id: "win1_b", text: "Stay calm, take charge and tell everyone where to be.", points: { L: 2, P: 1 } },
    { id: "win1_c", text: "Put an arm around his teammates and keep them believing.", points: { G: 1, L: 1 } },
  ] },
  win2: { text: "What would make you lose respect for a player?", options: [
    { id: "win2_a", text: "Not running. Giving up on the ball.", points: { W: 2, S: 1 } },
    { id: "win2_b", text: "Being unprofessional. Partying, turning up late to training.", points: { P: 2, L: 1 } },
    { id: "win2_c", text: "Being nasty. Mocking opponents or fans.", points: { G: 1, L: 1 } },
  ] },
  entertain1: { text: "Which moment would you rather see?", options: [
    { id: "ent1_a", text: "A piece of skill that leaves three defenders on the floor.", points: { A: 2 } },
    { id: "ent1_b", text: "A crazy goal and a wild celebration in front of the away fans.", points: { M: 2 } },
    { id: "ent1_c", text: "A team goal where every player touches the ball.", points: { S: 2, A: 1 } },
  ] },
  entertain2: { text: "A player you love gets into trouble off the pitch. How do you feel?", options: [
    { id: "ent2_a", text: "It doesn't matter. He is a genius on the pitch.", points: { M: 2, A: 1 } },
    { id: "ent2_b", text: "He needs to sort himself out. The club comes first.", points: { P: 2, L: 1 } },
    { id: "ent2_c", text: "I hope he is OK. Players are human too.", points: { G: 1, S: 1 } },
  ] },
  connect1: { text: "Which player would you be proudest of?", options: [
    { id: "con1_a", text: "One who never stops working for the team, even when nobody notices.", points: { S: 2 } },
    { id: "con1_b", text: "One who is kind, polite and great with kids and fans.", points: { G: 2 } },
    { id: "con1_c", text: "One who stands up for the club when things go wrong.", points: { L: 2, S: 1 } },
  ] },
  connect2: { text: "After a heavy defeat, what should the players do?", options: [
    { id: "con2_a", text: "Hurt. Be angry. Show everyone it matters.", points: { W: 1, M: 1 } },
    { id: "con2_b", text: "Walk over to the fans, clap them and say sorry.", points: { S: 2 } },
    { id: "con2_c", text: "Stay positive. Smile, learn and move on.", points: { G: 2, P: 1 } },
  ] },
  core1: { text: "If your player had to describe himself in three words, which would you want to hear?", options: [
    { id: "core1_a", text: "Hungry. Tough. Proud.", points: { W: 2, L: 1 } },
    { id: "core1_b", text: "Free. Creative. Fearless.", points: { A: 2, M: 1 } },
    { id: "core1_c", text: "Kind. Humble. Lovely.", points: { G: 2, S: 1 } },
  ] },
  core2: { text: "A rival player keeps winding up your striker. What should he do?", options: [
    { id: "core2_a", text: "Give it back. Don't let anyone walk over you.", points: { M: 2 } },
    { id: "core2_b", text: "Ignore it and answer with a goal.", points: { P: 1, L: 1, A: 1 } },
    { id: "core2_c", text: "Shake his hand and laugh it off.", points: { G: 1, P: 1 } },
  ] },
  tW: { lead: "W", text: "Your hardest-working player gets sent off for a crazy tackle in a big game. What do you think?", options: [
    { id: "tW_a", text: "I'd rather that than a player who doesn't care.", points: { W: 2 } },
    { id: "tW_b", text: "Stupid. He let the team down.", points: { P: 1, L: 1 } },
    { id: "tW_c", text: "I just hope the other player is OK.", points: { G: 1, S: 1 } },
  ] },
  tL: { lead: "L", text: "Your captain is a great leader but slower than a younger player. Who starts?", options: [
    { id: "tL_a", text: "The captain. You can't buy leadership.", points: { L: 2 } },
    { id: "tL_b", text: "The younger player. Pick the best team.", points: { P: 2 } },
    { id: "tL_c", text: "Whoever keeps the dressing room happiest.", points: { G: 1, S: 1 } },
  ] },
  tP: { lead: "P", text: "One player gives you 7 out of 10 every week. Another gives you a 10 or a 4. Who do you want?", options: [
    { id: "tP_a", text: "The 7 every week. You know what you're getting.", points: { P: 2 } },
    { id: "tP_b", text: "The 10 or the 4. Big moments win games.", points: { A: 1, M: 1 } },
    { id: "tP_c", text: "Whichever one works hardest for the team.", points: { S: 2 } },
  ] },
  tA: { lead: "A", text: "Your most gifted player never runs back to defend, and the team concedes because of it. What do you think?", options: [
    { id: "tA_a", text: "Worth it. He wins us more than he costs us.", points: { A: 2 } },
    { id: "tA_b", text: "Not acceptable. Everyone defends.", points: { S: 1, W: 1 } },
    { id: "tA_c", text: "Talk to him kindly. He will get there.", points: { G: 1, L: 1 } },
  ] },
  tM: { lead: "M", text: "Your favourite player argues with the manager in front of everyone. What do you think?", options: [
    { id: "tM_a", text: "Good. He cares and he says what he thinks.", points: { M: 2 } },
    { id: "tM_b", text: "Wrong. Keep it inside the dressing room.", points: { P: 1, L: 1 } },
    { id: "tM_c", text: "Sad to see. I hope they make up.", points: { G: 1, S: 1 } },
  ] },
  tS: { lead: "S", text: "Your most loyal player is not good enough anymore. What should the club do?", options: [
    { id: "tS_a", text: "Keep him. Loyalty has to mean something.", points: { S: 2 } },
    { id: "tS_b", text: "Sell him. The team comes first.", points: { P: 1, W: 1 } },
    { id: "tS_c", text: "Give him a new role, like coach or mentor.", points: { L: 1, G: 1 } },
  ] },
  tG: { lead: "G", text: "Your nicest player is loved by everyone but rarely wins a battle. What do you think?", options: [
    { id: "tG_a", text: "That's fine. Football needs good people.", points: { G: 2 } },
    { id: "tG_b", text: "Nice is not enough. He needs some fight.", points: { W: 2 } },
    { id: "tG_c", text: "He has to raise his level or lose his place.", points: { P: 2 } },
  ] },
};

export const BRANCHES = {
  win: ["win1", "win2"],
  entertain: ["entertain1", "entertain2"],
  connect: ["connect1", "connect2"],
};

export const PERCEPTION = {
  text: "Now think about your own club's players today. Which sounds most like them?",
  options: [
    { id: "W", text: "Fighters who never give up." },
    { id: "L", text: "Strong characters who take charge." },
    { id: "P", text: "Reliable and disciplined." },
    { id: "A", text: "Skilful and fun to watch." },
    { id: "M", text: "Unpredictable and full of emotion." },
    { id: "S", text: "Hard-working team players." },
    { id: "G", text: "Nice, friendly and easy to like." },
  ],
};

export const AGE_BRACKETS = ["Under 18", "18 to 24", "25 to 34", "35 to 44", "45 to 54", "55 or over"];
export const TED_LASSO = ["Yes, all of it", "Some of it", "No"];

const EMPTY = () => Object.fromEntries(ORDER.map((key) => [key, 0]));

export function findOption(questionId, optionId) {
  const question = QUESTIONS[questionId];
  if (!question) return null;
  return question.options.find((option) => option.id === optionId) ?? null;
}

export function scoreAnswers(answers) {
  const scores = EMPTY();
  const tensionPoints = EMPTY();
  const core1Points = EMPTY();
  for (const answer of answers ?? []) {
    const option = findOption(answer.questionId, answer.optionId);
    if (!option?.points) continue;
    const tension = String(answer.questionId).startsWith("t");
    const multiplier = tension ? 2 : 1;
    for (const [key, value] of Object.entries(option.points)) {
      const gained = value * multiplier;
      scores[key] = (scores[key] ?? 0) + gained;
      if (tension) tensionPoints[key] += gained;
      if (answer.questionId === "core1") core1Points[key] += value;
    }
  }
  return { scores, tensionPoints, core1Points };
}

export function rankArchetypes(answers) {
  const { scores, tensionPoints, core1Points } = scoreAnswers(answers);
  return [...ORDER].sort((a, b) => {
    if (scores[b] !== scores[a]) return scores[b] - scores[a];
    if (tensionPoints[b] !== tensionPoints[a]) return tensionPoints[b] - tensionPoints[a];
    if (core1Points[b] !== core1Points[a]) return core1Points[b] - core1Points[a];
    return ORDER.indexOf(a) - ORDER.indexOf(b);
  });
}

export function expectedQuestionId(answers) {
  const list = answers ?? [];
  if (list.length === 0) return "q1";
  if (list.length >= 6) return null;
  const first = list[0];
  const opening = findOption(first?.questionId, first?.optionId);
  const branch = BRANCHES[opening?.go] ? opening.go : null;
  if (!branch) return null;
  if (list.length === 1) return BRANCHES[branch][0];
  if (list.length === 2) return BRANCHES[branch][1];
  if (list.length === 3) return "core1";
  if (list.length === 4) return "core2";
  return `t${rankArchetypes(list.slice(0, 5))[0]}`;
}

export function publicQuestion(questionId, step) {
  const question = QUESTIONS[questionId];
  if (!question) return null;
  return {
    questionId,
    step,
    total: 10,
    text: question.text,
    options: question.options.map((option) => ({ id: option.id, text: option.text })),
  };
}

export function buildResult(answers, perception) {
  const rank = rankArchetypes(answers);
  const primaryKey = rank[0];
  const secondaryKey = rank[1];
  const seen = PERCEPTION.options.find((option) => option.id === perception) ?? null;
  return {
    primary: { key: primaryKey, name: ARCHETYPES[primaryKey].name, line: ARCHETYPES[primaryKey].line },
    secondary: { key: secondaryKey, name: ARCHETYPES[secondaryKey].name, line: ARCHETYPES[secondaryKey].line },
    perception: seen ? { key: seen.id, text: seen.text } : null,
    matches: seen?.id === primaryKey,
  };
}

export function enumeratePaths() {
  const primaryCounts = EMPTY();
  const leaderCounts = EMPTY();
  let total = 0;
  for (const q1 of QUESTIONS.q1.options) {
    const [second, third] = BRANCHES[q1.go];
    for (const o2 of QUESTIONS[second].options) {
      for (const o3 of QUESTIONS[third].options) {
        for (const o4 of QUESTIONS.core1.options) {
          for (const o5 of QUESTIONS.core2.options) {
            const prefix = [
              { questionId: "q1", optionId: q1.id },
              { questionId: second, optionId: o2.id },
              { questionId: third, optionId: o3.id },
              { questionId: "core1", optionId: o4.id },
              { questionId: "core2", optionId: o5.id },
            ];
            const lead = rankArchetypes(prefix)[0];
            const tensionId = `t${lead}`;
            for (const o6 of QUESTIONS[tensionId].options) {
              total += 1;
              leaderCounts[lead] += 1;
              const primary = rankArchetypes([...prefix, { questionId: tensionId, optionId: o6.id }])[0];
              primaryCounts[primary] += 1;
            }
          }
        }
      }
    }
  }
  return { total, primaryCounts, leaderCounts };
}
