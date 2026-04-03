# Ghostline - Student Quick Start Guide

Learn to teach your CoDrone EDU to fly autonomous routes!

## What is Ghostline?

Ghostline is a tool that lets you:
1. **Teach** - Fly your drone manually while recording
2. **Replay** - Watch the drone fly the route automatically
3. **Optimize** - Let AI improve the route to be faster
4. **Compete** - Compare times with your classmates

Think of it like teaching a self-driving car, but for drones!

---

## Getting Started

### Step 1: Open Ghostline

**Option A: Desktop App**
1. Double-click `Ghostline-Portable.exe` (or your OS version)
2. Wait for the app to load
3. You'll see the Ghostline landing page

**Option B: Chrome Extension**
1. Open Chrome
2. Go to: https://quantum-control.web.app/ghostline
3. Extension icon should show "Connected"

### Step 2: Create Your Workspace

1. Click "Create Workspace"
2. Give it a name (e.g., "My Drone Lab")
3. Add a description (optional)
4. Click "Create"

### Step 3: Create a Session

1. Click on your workspace
2. Click "Create Session"
3. Name it after your course (e.g., "Indoor Course A")
4. Click "Create"

### Step 4: Connect Your Drone

1. Power on your CoDrone EDU
2. Connect via USB cable
3. In Ghostline, click "Teach Mode" in the sidebar
4. Click "Connect to Drone"
5. Wait for green "Connected" status

---

## Teaching Your First Route

### What is Teaching?

Teaching is when you fly the drone manually while Ghostline records everything:
- Your joystick movements
- The drone's position
- Sensor readings
- Battery level

Later, the drone can replay this exact flight!

### How to Teach

1. **Go to Teach Mode**
   - Click "Teach Mode" in the sidebar
   - Make sure drone shows "Connected"

2. **Start Recording**
   - Click "Start Recording"
   - Button turns red
   - Status shows "● RECORDING"

3. **Fly Your Route**
   - Use the controller to fly
   - Go through your course
   - Try to fly smoothly
   - Avoid crashes!

4. **Stop Recording**
   - Click "Stop Recording"
   - Ghostline saves your flight
   - You'll see a confirmation message

5. **Record More Runs** (Optional)
   - You can record multiple runs
   - More runs = better baseline
   - Each run is saved separately

### Tips for Good Teaching

✅ **DO:**
- Fly smoothly and steadily
- Keep the drone in sight
- Watch your battery level
- Practice the route first

❌ **DON'T:**
- Make sudden jerky movements
- Fly too fast
- Let battery get too low
- Crash into obstacles

---

## Creating Checkpoints

### What are Checkpoints?

Checkpoints are invisible gates your drone must fly through. They help:
- Verify the drone is on course
- Measure performance
- Compare different runs

### How to Create Checkpoints

1. **Go to Checkpoints Tab**
   - Click "Checkpoints" in sidebar
   - You'll see the checkpoint editor

2. **Add a Checkpoint**
   - Click "+ Add Checkpoint"
   - Give it a name (e.g., "Start Gate")
   - Set position (X, Y, Z coordinates)
   - Set radius (how big the gate is)

3. **Add More Checkpoints**
   - Create checkpoints for key points
   - Start, turns, obstacles, finish
   - At least 3-5 checkpoints recommended

### Checkpoint Tips

- Place checkpoints at important spots
- Make radius big enough (30-50 cm)
- Number them in order
- Test with replay to verify

---

## Replaying Your Route

### What is Replay?

Replay makes the drone fly your recorded route automatically. No controller needed!

### How to Replay

1. **Go to Replay Tab**
   - Click "Replay" in sidebar
   - Make sure baseline is loaded

2. **Start Replay**
   - Click "Start Replay"
   - Drone will take off automatically
   - It follows your recorded path

3. **Watch Carefully**
   - Stay ready to catch the drone
   - Watch for obstacles
   - Monitor battery

4. **Emergency Stop**
   - Press emergency stop if needed
   - Drone will land immediately

### Safety Rules

⚠️ **IMPORTANT:**
- Always have a spotter
- Clear the flight area
- Keep emergency stop ready
- Never leave drone unattended
- Follow school safety rules

---

## Optimization (Advanced)

### What is Optimization?

Optimization uses AI to improve your route:
- Flies faster
- Takes better paths
- Maintains safety
- Clears all checkpoints

### How It Works

1. Starts with your taught route
2. Makes small changes
3. Tests the new route
4. Keeps improvements
5. Repeats many times

### How to Optimize

1. **Go to Optimize Tab**
   - Click "Optimize" in sidebar
   - Verify baseline and checkpoints loaded

2. **Start Optimization**
   - Click "Start Optimization Loop"
   - Drone will fly many test runs
   - Each run tries to be faster

3. **Monitor Progress**
   - Watch the run counter
   - See best time improve
   - Check battery levels

4. **Stop When Done**
   - Click "Stop Optimization"
   - Review the best run
   - Save your results

### Optimization Tips

- Start with good baseline
- Have spare batteries ready
- Takes 20-50 runs typically
- Be patient - it learns!

---

## Viewing History

### Run History

See all your recorded flights:
- Run number
- Time taken
- Checkpoints cleared
- Battery used
- Valid/invalid status

### Comparing Runs

- Find your best run
- See improvement over time
- Compare with classmates
- Learn from mistakes

---

## Troubleshooting

### Drone Won't Connect

**Try:**
1. Check USB cable
2. Power cycle drone
3. Restart Ghostline
4. Try different USB port

### Recording Not Working

**Try:**
1. Verify drone connected
2. Check battery level
3. Restart recording
4. Check console for errors

### Replay Goes Wrong

**Try:**
1. Re-teach the route
2. Check checkpoint positions
3. Verify clear flight area
4. Start with slower speeds

### App Crashes

**Try:**
1. Restart the app
2. Check internet connection
3. Clear browser cache (extension)
4. Contact your teacher

---

## Competition Ideas

### Time Trials
- Who can complete the course fastest?
- Must clear all checkpoints
- Best of 3 runs

### Optimization Challenge
- Start with same baseline
- Run optimization for 30 minutes
- Best final time wins

### Course Design
- Design your own course
- Create checkpoints
- Challenge classmates

### Efficiency Contest
- Fastest time per battery %
- Smoothest flight path
- Most consistent runs

---

## Learning Objectives

By using Ghostline, you'll learn:

**Programming Concepts:**
- Autonomous systems
- Machine learning basics
- Optimization algorithms
- Data collection

**Robotics:**
- Sensor fusion
- Control systems
- Path planning
- Safety protocols

**Engineering:**
- Iterative design
- Testing and validation
- Performance metrics
- Problem solving

**Teamwork:**
- Collaboration
- Documentation
- Peer review
- Competition

---

## Need Help?

**Ask Your Teacher:**
- Technical issues
- Safety questions
- Project ideas
- Competition rules

**Check Documentation:**
- `GHOSTLINE_SETUP.md` - Setup guide
- `GHOSTLINE_DEPLOYMENT.md` - Installation
- Backend README - Technical details

**Debug Yourself:**
- Check console logs
- Read error messages
- Try simple tests first
- Document what you tried

---

## Safety Reminders

🚨 **ALWAYS:**
- Get teacher permission
- Clear the flight area
- Have a spotter
- Keep emergency stop ready
- Follow school rules
- Respect equipment
- Report damage immediately

🚫 **NEVER:**
- Fly near people
- Fly outside designated area
- Modify drone hardware
- Ignore low battery warnings
- Leave drone unattended
- Fly without supervision

---

## Have Fun!

Ghostline is a powerful tool for learning robotics and AI. Experiment, learn from failures, and celebrate successes. Most importantly - have fun teaching your drone to fly!

🚁 Happy Flying! 🚁
