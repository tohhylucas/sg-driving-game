# Singapore Driving Game

This context defines the domain language for a browser-based driving game that
teaches Singapore driving habits and road conventions.

## Language

**Singaporean accuracy**:
Road layout, markings, default driving behavior, and future rule behavior should
match Singapore driving conventions whenever the project references real-world
driving practice.
_Avoid_: Mockup-first markings, generic road accuracy, US/EU defaults

**Cockpit overlay**:
An in-car visual layer presented over the driving view, containing the mirrors
and basic driver instruments.
_Avoid_: Cockpit camera, full car interior

**Right-hand-drive viewpoint**:
Driver-facing presentation should be anchored on the vehicle's right side when
the game shows steering wheel or driver-position cues.
_Avoid_: Centered generic driver view, left-hand-drive placement

**Instructor audio**:
Future instructor guidance is delivered through TTS audio only, without
on-screen instructional text or transcripts.
_Avoid_: Caption text, text prompts, readable instruction panels
