# How The Drone Sim Works

Imagine the drone is a tiny flying table with four fans.

## What Makes It Go Up?

The fans push air down.

When the air gets pushed down hard enough, the drone goes up.

Gravity pulls it down at the same time.

So the drone is always doing a tug-of-war:

- fans push up
- gravity pulls down

If pushing up wins, the drone climbs.
If gravity wins, the drone falls.
If they match, the drone hovers.

## Why It Does Not Just Stop Right Away

If the drone moves forward, it keeps moving for a tiny bit.

That happens because moving things have momentum.

Air also pushes back on the drone. That is called drag.

So:

- momentum keeps it going
- drag slows it down

## Why Going Down Can Feel Messier

When the drone goes down, it can fly through the air it just pushed down.

That air is messy and swirly.

We call that dirty air.

So when the drone comes down, it may:

- wiggle a little
- sway a little
- feel less smooth

But it should not spin like crazy for no reason.

## Why It Used To Spin

The old version let the physics engine twist the drone too much.

That made the drone act silly.

Now the app keeps the drone pointed in a steady way unless you tell it to turn.

So it can:

- go up
- go down
- move forward
- bump into things

without freaking out.

## Why The Drone Model Size Matters

If the drone picture is too big or too small, collisions feel wrong.

So the app rescales the drone model to match the real CoDrone EDU size:

- about `138.5 mm` wide
- about `138.5 mm` long
- about `34.8 mm` tall

That means even a temporary model can still act like the real drone if it is resized correctly.

## Simple Version

The sim tries to make the drone act like this:

- smooth when taking off
- a little floaty when moving
- a little wobbly when landing
- not randomly spin unless you tell it to turn
