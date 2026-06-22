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

**Fixed test track**:
A hand-built deterministic Phase 1 driving environment used as the stable road
layout for future rule testing.
_Avoid_: Procedural map, generated level, scenario

**T-junction**:
A road junction where one side road meets another road without continuing
through it.
_Avoid_: Three-way intersection

**Cross junction**:
A road junction where two roads cross through each other, creating four
approaches.
_Avoid_: Crossroad, four-way intersection

**Uncontrolled junction**:
A junction with static road geometry but no active signal, priority, scoring,
or instructor behavior in Phase 1.
_Avoid_: Traffic-light junction, rule-enforced junction

**Stop line**:
A static road marking placed before a junction approach to support future rule
testing.
_Avoid_: Stop rule, stop enforcement, stop feedback
