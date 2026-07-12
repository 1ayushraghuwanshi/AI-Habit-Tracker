import "dotenv/config";
import mongoose from "mongoose";
import { format, subDays } from "date-fns";
import {connectDB} from "../config/db.js";
import User from "../models/User.js";
import Habit from "../models/Habit.js";
import HabitLog from "../models/HabitLog.js";
import AIInsight from "../models/AIInsights.js";

const EMAIL = "ayush@gmail.com";
const PASSWORD = "password123";
const NAME = "Alex Rivera";

const HABITS = [
    {
        name: "Drink 2L of water",
        description: "Stay hydrated throughout the day.",
        category: "Health",
        frequency: "daily",
        targetDays: 7,
        color: "#0ea5e9",
        icon: "💧",
        _streakProb: 0.95,
    },
    {
        name: "Morning run",
        description: "30-minute run before breakfast.",
        category: "Fitness",
        frequency: "daily",
        targetDays: 5,
        color: "#0ef4444",
        icon: "🏃",
        _streakProb: 0.7,
        _pattern: "weekdays",
        _brokenAt: 20,
    },
        {
        name: "Read 20 Minutes",
        description: "Fiction or non-fiction, no phone.",
        category: "Learning",
        frequency: "daily",
        targetDays: 7,
        color: "#6366f1",
        icon: "📚",
        _streakProb: 0.82,
    },
    {
        name: "Morning Green Tea",
        description: "Brew and drink a cup of warm green tea after waking up.",
        category: "Health",
        frequency: "daily",
        targetDays: 7,
        color: "#14b8a6",
        icon: "🍵",
        _streakProb: 0.90,
    },
    {
        name: "Gym Workout",
        description: "45 minutes of resistance training or cardio.",
        category: "Fitness",
        frequency: "daily",
        targetDays: 5,
        color: "#f97316", // Orange
        icon: "🏋️",
        _streakProb: 0.75,
    },
    {
        name: "Mindful Meditation",
        description: "10 minutes of unguided breathing and focus work.",
        category: "Health",
        frequency: "daily",
        targetDays: 7,
        color: "#a855f7",
        icon: "🧘",
        _streakProb: 0.80,
    },
    {
        name: "Deep Work Sprint",
        description: "90 minutes of continuous coding without distractions.",
        category: "Productivity",
        frequency: "daily",
        targetDays: 5,
        color: "#3b82f6", 
        icon: "💻",
        _streakProb: 0.85,
    },
    {
        name: "LeetCode Practice",
        description: "Solve at least 1 Medium algorithmic problem.",
        category: "Learning",
        frequency: "daily",
        targetDays: 6,
        color: "#eab308", 
        icon: "🧠",
        _streakProb: 0.78,
    },
    {
        name: "Journal Entry",
        description: "Write down 3 daily wins and a primary lesson.",
        category: "Mindfulness",
        frequency: "daily",
        targetDays: 7,
        color: "#ec4899",
        icon: "📝",
        _streakProb: 0.70,
        _pattern: "dropoff",
    },
    {
        name: "Weekly Review",
        description: "Review financial ledgers and upcoming architecture targets.",
        category: "Productivity",
        frequency: "weekly",
        targetDays: 1,
        color: "#10b981", 
        icon: "📊",
        _streakProb: 0.95,
    }
]

const todayKey = () => format(new Date(), "yyyy-MM-dd");

const buildLogs = (habit, totalDays = 90) => {
    const logs = [];
    const today = new Date();
    for(let i =0; i<totalDays;i++){
        const d = subDays(today, i);
        const dow = d.getDay();
        const key = format(d, "yyyy-MM-dd");
        let p = habit._streakProb;

        if(habit._pattern === "weekdays") {
            if(dow === 0 || dow === 6) p *= 0.35;  
        }
        if(habit._pattern === "dropoff"){
            if(i < 14) p *= 0.25;
        }
        if(habit._brokenAt && i >= habit._brokenAt-2 && i <= habit._brokenAt +2){
            continue;
        }
        const seed = Math.sin(i * 9301 + habit.name.length * 49297) * 233280;
        const rnd = seed-Math.floor(seed);
        if(rnd < p) logs.push({ completedDate: key });
    }
    return logs;
};

const run = async () => {
    await connectDB();

    let user = await User.findOne({ email: EMAIL });
    if (user) {
        console.log(`Found existing user ${EMAIL} - clearing their data...`);
        await Habit.deleteMany({ userId: user._id });
        await HabitLog.deleteMany({ userId: user._id });
        await AIInsight.deleteMany({ userId: user._id });
        user.name = NAME;
        user.avatar = NAME.charAt(0).toUpperCase();
        user.morningMotivation = true;
        user.password = PASSWORD;
        await user.save();
    } else {
        user = await User.create({
            name: NAME,
            email: EMAIL,
            password: PASSWORD,
            avatar: NAME.charAt(0).toUpperCase(),
            morningMotivation: true,
        });
        console.log(`Created user ${EMAIL}`);
    }
    const createdHabits = [];
  for (let i = 0; i < HABITS.length; i++) {
    const h = HABITS[i];
    const habit = await Habit.create({
        userId: user._id,
        name: h.name,
        description: h.description,
        category: h.category,
        frequency: h.frequency,
        targetDays: h.targetDays,
        color: h.color,
        icon: h.icon,
        order: i,
        createdAt: subDays(new Date(), 89),
        updatedAt: subDays(new Date(), 89),
    });
    habit.createdAt = subDays(new Date(), 89);
    await habit.save({ timestamps: false });
    createdHabits.push({ habit, config: h });
}

let totalLogs = 0;
for (const { habit, config } of createdHabits) {
    const logs = buildLogs(config);
    if (!logs.length) continue;
    const docs = logs.map((l) => ({
        userId: user._id,
        habitId: habit._id,
        completedDate: l.completedDate,
    }));
    await HabitLog.insertMany(docs, { ordered: false }).catch(() => {});
    totalLogs += docs.length;
}

const today = todayKey();
const todayDoneHabits = createdHabits.slice(0, 4).map((c) => c.habit);
for (const h of todayDoneHabits) {
    await HabitLog.updateOne(
        { userId: user._id, habitId: h._id, completedDate: today },
        { $setOnInsert: { userId: user._id, habitId: h._id, completedDate: today } },
        { upsert: true }
    );
}

console.log('\n Seed complete');
console.log(` User:     ${EMAIL}`);
console.log(` Password: ${PASSWORD}`);
console.log(` Habits:   ${createdHabits.length}`);
console.log(` Logs:     ${totalLogs}`);
await mongoose.disconnect();

};

run().catch(async (err) => {
    console.error("Seed Failed:", err);
    await mongoose.disconnect();
    process.exit(1);
    
})