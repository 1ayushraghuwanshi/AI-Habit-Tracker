import Habit from "../models/Habit.js";
import HabitLog from "../models/HabitLog.js";
import AIInsight from "../models/AIInsights.js";
import { chatCompletion, SYSTEM_PROMPTS } from "../utils/aiService.js";
import { todayKey, lastNDays, calcStreak } from "../utils/dateHelper.js";


const buildWeeklyContext = async (userId) => {
 
  const habits = await Habit.find({ userId, isArchived: false });
const days = lastNDays(7);
  const logs = await HabitLog.find({
    userId,
    completedDate: { $gte: days[0], $lte: days[days.length-1] },
  });

  const perHabit = habits.map((h)=> {
    const completed = logs.filter((l)=> String(l.habitId) === String(h._id)).length;
    return {
      name: h.name,
      category: h.category,
      frequency: h.frequency,
      completedDays: completed,
      targetDays: h.targetDays,
    };
  });

  return {
    days, perHabit
  };
};

export const weeklyReport = async(req, res) => {
  try{
    const ctx = await buildWeeklyContext(req.user._id);
    if(!ctx.perHabit.length){
        return res.json({
            content: 
                "You haven't tracked any habits this week yet! Create some habits and start checking them off to unlock your personalized weekly performance analysis."
            
        })
    }
   const userMsg = `Here is the user's habit data for the past 7 days (${ctx.days[0]} to ${ctx.days[6]}):\n\n${ctx.perHabit
.map(
    (h) => `-${h.name} (${h.category}, ${h.frequency}): completed ${h.completedDays} of the past 7 days, target ${h.targetDays}/week`
).join("\n")}\n\nPlease write the personalized weekly report now.`;

const { content } = await chatCompletion({
    system: SYSTEM_PROMPTS.weekly,
    user: userMsg,
});

await AIInsight.create({
    userId: req.user._id,
    type: "weekly",
    content,
});
res.json({ content });
  }catch(err){
    res.status(500).json( {message: err.message});
  }
};

export const suggestHabits = async (req, res) => {
    try {
        const { goals, productiveTime, struggles } = req.body;
        const userMsg = `User goals: ${goals || "not provided"}\nMost productive time: ${productiveTime || "not provided"}\nPast struggles: ${struggles || "not provided"}\n\nSuggest 3 personalised habits now. Return JSON only.`;
        const { content } = await chatCompletion({
            system: SYSTEM_PROMPTS.suggestion,
            user: userMsg,
        });
     let suggestions = [];
     try {
        const parsed = JSON.parse(content.replace(/```json|```/g, "").trim());
        suggestions = parsed.suggestions || [];
     }catch{
        suggestions = [];
     }
     if(!suggestions.length){
        suggestions = [
  {
    "name": "Hydration Anchor",
    "description": "Drink 500ml water immediately after waking up.",
    "frequency": "Daily",
    "category": "Health",
    "reason": "Complements your physical habits and kicks off metabolism early."
  },
  {
    "name": "Box Breathing",
    "description": "4 seconds inhale, hold, exhale, hold. Repeat for 2 minutes.",
    "frequency": "Daily",
    "category": "Mental Wellness",
    "reason": "Quickly recalibrates focus before deep work sessions."
  },
  {
    "name": "Weekly Review",
    "description": "Dedicate 15 minutes every Sunday to organize tasks.",
    "frequency": "Weekly",
    "category": "Productivity",
    "reason": "Aligns with your weekly reports to optimize execution."
  }
];
     }

     await AIInsight.create({
        userId: req.user._id,
        type: "suggestion",
        content: JSON.stringify(suggestions),
        meta: {goals, productiveTime, struggles},
     });
     res.json({ suggestions});
    }catch(err){
        res.status(500).json({message: err.message});
    }
}


export const recoveryPlan = async (req, res) => {
    try {
        const { habitId } = req.body;
        const habit = await Habit.findOne({
            _id: habitId,
            userId: req.user._id,
        });
        if(!habit) return res.status(404).json({message: "Habit not found"});

        const log = await HabitLog.find({
             userId: req.user._id,
             habitId,
        }).sort({ completedDate: -1});
        const keys = logs.map((l) => l.completedDate);
        const { current, longest } = calcStreak(keys);

        const userMsg = `Habit: ${habit.name} (${habit.category}).\nDescription: ${habit.description || "none"}.\nCurrent streak: ${current} days. Longest ever: ${longest} days. The user broke a streak. Write a warm, actionable 3-day recovery plan.`;
    
       const { content } = await chatCompletion({
        system: SYSTEM_PROMPTS.recovery,
        user: userMsg,
       });
       await AIInsight.create({
        userId: req.user._id,
        type: "recovery",
        content,
        meta: { habitId },
       });
       res.json({ content });
      }catch(err){
        res.status(500).json({ message: err.message });
      }
};

export const chatAnalysis = async(req, res) => {
  try{
    const { question } =req.body;
    if(!question)
      return res.status(400).json({ message: "Question is required "});

     const habits = await Habit.find({
      userId: req.user._id,
      isArchived: false,
     });
    const days = lastNDays(30);
    const logs = await HabitLog.find({
      userId: req.user._id,
      completedDate: { $gte: days[0], $lte: days[days.length-1]},
    });

    const context = habits.map((h) => {
      const hLogs = logs.filter(
        (l) => String(l.habitId) === String(h._id)
      );

      const byDow = [0, 0, 0, 0, 0, 0, 0];
      for(const l of hLogs){
        const dow = new Date(l.completedDate).getDay();
        byDow[dow] += 1;
      }
      return `${h.name}  (${h.category}): ${hLogs.length}/30 in last 30 days, by weekday [Sun, Mon, Tue, Wed, Thur, Fri, Sat]
      byDow
    })`;
  }).join("\n");

  const userMsg = `User question: "${question}"\n\nUser data (last 30 days):\n${context}\n\nAnswer now.`;
  const { content } = await chatCompletion({
    system: SYSTEM_PROMPTS.chat,
    user: userMsg,
  });
  await AIInsight.create({
    userId: req.user._id,
    type: "chat",
    content,
    meta: { question },
  });
  res.json({ content });
}catch(err){
  res.status(500).json({ message: err.message });
}
}

export const morningMotivation = async(req, res) => {
  try{
    const habits = await Habit.find({
      userId: req.user._id,
      isArchived: false,
    });
    if(!habits.length){
      return res.json({
        content:
        "Good Morning! Add your first habit today and let's get the momentum started.",
      });
    }
      const days = lastNDays(30);
      const logs = await HabitLog.find({
        userId: req.user._id,
        completedDate: { $gte: days[0], $lte: days[days.length-1]},
      });


      const ctx = habits
      .map((h) => {
        const hLogs = logs
             .filter((l) => String(l.habitId) === String(h._id))
             .map((l) => l.completedDate)
             .sort()
             .reverse();
             const { current } = calcStreak(hLogs);
             return `${h.name}: current streak ${current}`;
      })
      .join("\n");

      const today = todayKey();
      const todayLogs = logs.filter((l) => l.completedDate === today);
      const done = todayLogs.length;
      const total = habits.length;

      const userMsg = `Today's habits and streaks:\n${ctx}\n\nDone today: ${done}/${total}. Write the morning motivation`
      const { content } = await chatCompletion({
        system: SYSTEM_PROMPTS.morning,
        user: userMsg,
        temperature: 0.8,
      });
      await AIInsight.create({
        userId: req.user._id,
        type: "morning",
        content,
      });
      res.json({ content });
    }catch(err){
      res.status(500).json({ message: err.message });
    }
  
}