# Real World Quests

Yes. For the first prototype, I would keep the prompt very strict so Lovable doesn't turn it into a generic Google Maps clone or overcomplicate it.

Build a Real-World Exploration Game Prototype

I want you to build a working web/mobile-friendly prototype for an exploration game.

The concept is simple:

A person is bored at home and wants a reason to go outside. The app gives them a random destination to explore. There is no treasure and no required landmark. The destination itself is the "quest."

The app should feel like a real-world exploration game, not like Google Maps.

CORE EXPERIENCE

The user opens the app.

Ask for permission to access the user's location.

Get the user's live GPS position.

Display a full-screen interactive map centered on the user's current location.

Display the user's position as a blue player marker.

Generate a fixed exploration destination somewhere a reasonable distance away.

Display that destination as a large X / cross, not a normal Google Maps pin.

The user physically moves.

Their blue position marker must update as their GPS location changes.

The destination X must remain fixed.

Show the distance between the player and the destination and update it in real time.

When the user reaches the destination radius, display DESTINATION REACHED.

The goal is to make the user feel like they are playing an exploration game in the real world.

MAP DESIGN

Use the attached screenshot as visual inspiration for the map interface.

The map should have a game-map / Minecraft-map feeling:

top-down map

terrain/road imagery

visible coordinate grid

blue player marker

large destination X

dark/blue game-style interface

compact controls

coordinates displayed clearly

zoom controls

compass/direction indicator

Do NOT make it look like a standard Google Maps application.

The map itself should still use real-world map data so the user's actual surroundings are visible.

The interface should feel like:

"I am exploring a real world that has been turned into a game."

PLAYER POSITION

The user's live location should be represented by a blue circular marker.

It must update whenever the device's GPS position changes.

The marker should clearly show:

YOU

Optionally add a small directional indicator showing the direction the user is moving.

The map should automatically follow the player when appropriate, but the user should also be able to move/zoom the map manually.

DESTINATION

For this first prototype, DO NOT use AI.

Instead, generate a random destination algorithmically.

The destination should be:

reasonably close to the user

preferably around 2–7 km away

reachable by normal roads or paths when possible

not inside obviously dangerous or impossible locations

not constantly changing

generated once when the expedition begins

Once generated, the destination is FIXED.

Represent it with a large mysterious:

✕

Do not use a standard red location pin.

The user should not initially be told what is at the destination.

The mystery is intentional.

DISTANCE

Display the live distance between the player and destination.

Example:

DISTANCE TO DESTINATION
4.27 KM

As the user moves:

4.27 KM → 4.01 KM → 3.76 KM → 2.94 KM...

The distance must update using the user's actual GPS position.

When close enough, show:

DESTINATION REACHED

Use a reasonable arrival radius such as 30–50 meters.

COORDINATE SYSTEM

I want a Minecraft-inspired coordinate system.

Do NOT prominently display raw latitude/longitude.

Instead, create a simple fictional exploration grid based on the user's real GPS coordinates.

Display something like:

X: 1842
Z: -731

The exact conversion does not matter for this prototype as long as:

coordinates are stable

nearby movement causes the coordinates to change logically

the destination has its own fixed X/Z coordinates

the coordinate grid moves consistently with the real-world map

Show the player's coordinates somewhere on the interface.

Example:

YOU
X: 1842
Z: -731

DESTINATION
X: 2164
Z: -418

The coordinate system is primarily for the game feeling.

MAP GRID

Add a subtle square grid over the map.

The grid should resemble a game-world coordinate grid.

It should not completely obscure the map.

The grid should remain aligned with the exploration coordinate system.

When zooming in/out, the grid should remain visually useful rather than becoming an unreadable mess.

TOP INFORMATION BAR

Create a compact game-style information bar at the top.

Example:

EXPEDITION #001

X: 1842 Z: -731

MAP: UNKNOWN TERRITORY

Keep the design minimal and polished.

BOTTOM INFORMATION PANEL

Add a bottom panel showing:

TODAY'S EXPEDITION

Destination: Unknown
Distance: 4.27 km
Direction: NE
Status: Exploring

The destination should remain mysterious.

Do not reveal a fake landmark or invent information about what exists there.

CONTROLS

Include simple game-style controls:

Zoom In

Zoom Out

Recenter on Player

Compass

Toggle Grid

Start Expedition

End Expedition

Keep the controls visually compact.

START SCREEN

Before starting the expedition, show a simple screen:

TODAY'S EXPEDITION

Somewhere out there is a place you've never visited.

Distance: approximately 2–7 km

[ BEGIN EXPEDITION ]

After pressing Begin Expedition:

generate the fixed destination

display the map

begin GPS tracking

display the destination X

IMPORTANT UX PRINCIPLE

The app should NOT feel like:

"Here is a place on Google Maps. Navigate there."

It should feel like:

"You have been given a destination. Go find it."

The user should have just enough information to travel there, while maintaining a sense of mystery.

PROTOTYPE LIMITATIONS

This is ONLY the first prototype.

Do NOT add:

user accounts

social features

AI

XP systems

achievements

leaderboards

complicated quests

chat

payments

subscriptions

fake historical information

fake landmarks

unnecessary dashboards

Focus entirely on making the core exploration loop work.

THE CORE LOOP

Open app

↓

Get GPS location

↓

Begin Expedition

↓

Generate fixed random destination

↓

Show player 🔵 and destination ✕

↓

User physically moves

↓

Blue marker follows their real GPS position

↓

Distance and coordinates update

↓

User reaches destination

↓

DESTINATION REACHED

This prototype should be functional, responsive, polished, and mobile-friendly.

The visual inspiration is the attached map screenshot: use its game-like map/interface feeling as inspiration, but create an original modern design rather than copying it exactly.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ventureforth.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f9f24104-35dc-4df6-9ddb-407ddd44cd52).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
