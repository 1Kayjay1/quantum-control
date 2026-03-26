# Quantum Control Flight Physics

## Purpose

This document explains the current drone-flight model used by Quantum Control and the assumptions behind it.

The goal is not to fake a perfect robot and not to fake a full CFD solver. The goal is:

- stable replay
- realistic enough climb, descent, drag, and sway behavior
- object interaction that helps route planning
- assumptions that can be traced back to real CoDrone EDU data where available

## Official CoDrone EDU Facts Used

Source: Robolink Basecamp, CoDrone EDU (JROTC ed.) introduction

- Size: `138.5 x 138.5 x 34.8 mm`
- Weight: `54.8 g`
- Battery: `3.7 V 530 mAh`
- Maximum velocity: `2.5 m/s`
- Sensors: gyroscope, accelerometer, barometer, front and bottom range, optical flow, color sensors
- Auto-hovering and stabilization are part of the real product behavior

Source links:

- https://archive.learn.robolink.com/lesson/0-1-introduction-to-codrone-edu-jrotc/
- https://docs.robolink.com/files/co-drone-edu-jrotc-manual-v-1-3.pdf
- https://learn.robolink.com/lesson/codrone-python-flight-movements/

## Important Inferences

Robolink does not publish the rotor RPM or exact propeller diameter on the product page or manual pages above.

Because of that, the following values are engineering estimates, not official OEM values:

- rotor radius used in the sim: `0.028 m`
- drag coefficient used in the sim: `1.05`

Those values were chosen to keep the drone envelope and movement feel consistent with:

- the real frame size
- the published top speed
- the fact that the real drone is light and indoor-only

## Coordinate And Scale Rules

- `1 scene unit = 1 meter`
- drone body target size:
  - width `0.1385 m`
  - length `0.1385 m`
  - height `0.0348 m`
- imported meshes are normalized to that size automatically

## Control Model

The real CoDrone EDU uses held control inputs:

- pitch
- roll
- yaw
- throttle

Quantum Control maps route events into that same structure:

- `Pitch Forward / Backward`
- `Roll Left / Right`
- `Throttle Up / Down`
- `Yaw Left / Right`
- each event has `strength` and `hold time`

This matches the real coding model more closely than commanding a perfect distance directly.

## Core Equations

### 1. Gravity

We apply Earth gravity:

`F_gravity = m * g`

Where:

- `m = 0.0548 kg`
- `g = 9.81 m/s^2`

### 2. Translational Control Force

The route planner produces a target horizontal velocity and a target vertical response.

The controller computes a force that tries to move current velocity toward target velocity:

`F_control = m * (v_target - v_current) * k_response`

This is a controlled-response model, similar to a damped flight controller rather than free ballistic flight.

### 3. Aerodynamic Drag

Horizontal and vertical drag use the standard quadratic drag equation:

`F_drag = -0.5 * rho * C_d * A * v * |v|`

Where:

- `rho = 1.225 kg/m^3` for air density
- `C_d = 1.05`
- `A` is projected area of the drone body

This is why the drone does not instantly stop when input ends, but also does not coast forever.

### 4. Ground Effect

Near the ground, rotor downwash increases lift efficiency. We model that using a bounded gain based on rotor radius and height:

`gain_ground = 1 + (R / (4h))^2`

clamped to a safe range.

This means:

- lift near the floor is a little easier
- takeoff should not look like random spin
- the drone should feel slightly lighter close to the ground

### 5. Dirty Air During Descent

During descent, especially with low forward motion, the drone can enter disturbed downwash. We model that as:

- reduced vertical effectiveness
- small lateral sway
- no uncontrolled random spin

The dirty-air factor is driven by:

- negative vertical velocity
- low horizontal speed

This produces the real-world behavior students expect:

- slight side-to-side wobble
- softer sink instability
- descent becoming less clean than a hover

### 6. Yaw Handling

Yaw is now controller-owned, not physics-solver-owned.

That is intentional.

The rigid-body solver was able to inject angular noise during contact, which caused unrealistic spin during simple climb commands. The current model keeps:

- translational physics
- collision response
- yaw command behavior

but removes accidental spin caused by solver noise.

## Collision Model

The drone still uses a physical collider and interacts with obstacles.

Current behavior:

- translational contact is real
- collision pushes the drone and affects route validity
- yaw is not allowed to spin out from solver noise

This is a deliberate tradeoff for route-planning reliability.

## Mesh Scaling

Quantum Control normalizes the imported drone mesh by bounding box and rescales it to the real CoDrone EDU dimensions.

That means any temporary model can be used as long as its overall shape is similar.

Target tolerance:

- within roughly `3-5 mm` of the CoDrone envelope after normalization

## Current Limitations

- Rotor RPM is inferred, not official.
- Propeller diameter is inferred, not official.
- Dirty air is modeled as bounded descent instability, not CFD.
- Rotor wash on nearby objects is simplified.

## Why This Model Is Better For The App

The app is a planning simulator, not a research wind tunnel.

This model is meant to be:

- stable enough to debug routes
- realistic enough to teach timing, drag, and drift
- understandable enough for students to tune

It is intentionally more physical than a pure kinematic preview, but more stable than a fully unconstrained rigid-body quadcopter sim.
