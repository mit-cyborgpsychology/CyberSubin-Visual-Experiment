
Cyber Subin 2.0 Lab — NO.60 Modification Panel

General Changes

* Change the project/lab name to Cyber Subin 2.0 Lab.
* Change all instances of “No.60” to “NO.60”.
* Add a new bottom panel, similar in structure and behavior to the existing Mix-Up panel.
* Place the new panel button directly underneath the NO.60 button.
* Name the new panel NO.60 Modification.

NO.60 Modification Mode

When NO.60 Modification is activated:

* Hide the other mode/panel buttons to reduce visual clutter.
* Display two avatar panels side by side:
    * Original — the unchanged NO.60 movement.
    * Modified — the movement with the NO.60 Modification parameters applied.
* Both avatars should play simultaneously so users can directly compare the original and modified movement.
* The Original avatar must remain completely unaffected by modification controls.
* The Modified avatar should update in real time as parameters change.

Controls

Each modification parameter should use a 0–100% slider wherever applicable.

Each parameter should also provide controls for the relevant body regions specified below.

Add:

* Master Slider (0–100%) — globally controls the intensity of all modification parameters while preserving their relative settings.
* Random button — independently randomizes all body-part and modification sliders.
* Reset button — restores all modification parameters to their default values.
* Show the current numeric percentage next to each slider.

⸻

Modification Elements

1. Energy

Use the same Energy visual representation found in the existing NO.60 Elements interface.

Purpose: Modify the amount of perceived energy in the movement.

Increasing or decreasing Energy should computationally alter the speed, acceleration, and/or movement intensity of the selected body region without unnecessarily changing the underlying pose sequence.

Range: 0–100%

Apply to:

* Whole Body
* Upper Body
* Lower Body
* Individual body parts where appropriate

Higher values should create faster, more energetic, and more active movement. Lower values should create slower and less energetic movement.

⸻

2. Circle + Curve

Use the same Circle + Curve visual representation found in NO.60 Elements.

Purpose: Control how circular, curved, smooth, or straight the movement trajectories are.

Use trajectory-processing techniques such as low-pass filtering, path smoothing, curve fitting, interpolation, or trajectory straightening to modify the curvature of the original motion.

The control should modify the movement trajectory while retaining the recognizable structure and timing of the original motion as much as possible.

Range: 0–100%

Lower values should produce straighter and less curved trajectories.

Higher values should emphasize smooth, circular, and curved trajectories.

Apply to:

* Whole Body
* Left Arm
* Right Arm
* Left Leg
* Right Leg

⸻

3. Axis Points

Use the same Axis Points visual representation found in NO.60 Elements.

Purpose: Make selected body parts respond more strongly to defined axis points.

Think of each axis point as a magnetic attraction point.

As a limb approaches an axis point, increasing this parameter should increase the attraction toward that point. At higher values, the limb can briefly snap toward, emphasize, or hold near the axis point before continuing toward the next pose.

The goal is to create movement that feels more punctuated, spotty, highlighted, and responsive to specific points around/on the body.

The effect should remain derived from the existing motion rather than replacing it with completely unrelated poses.

Range: 0–100%

* 0% = no axis-point attraction.
* 100% = strongest axis-point attraction/snap behavior.

Apply to:

* Whole Body
* Left Arm
* Right Arm
* Left Leg
* Right Leg

⸻

4. Synchronic Limbs

Use the same Synchronic Limbs visual representation found in NO.60 Elements.

Purpose: Control how synchronized or asynchronous different limbs are relative to one another.

This can be implemented by computationally adjusting the timing/phase offsets of limb motion while maintaining the underlying movement sequence.

Range: 0–100%

* 100% = original/normal synchronization.
* 0% = maximum asynchronous behavior, with limbs deliberately offset from one another.

Intermediate values should progressively introduce timing offsets rather than abruptly switching between synchronized and asynchronous movement.

Apply to:

* Whole Body
* Left Arm
* Right Arm
* Left Leg
* Right Leg

⸻

5. External Body Space

Use the same External Body Space visual representation found in NO.60 Elements.

Purpose: Emphasize negative/external space created around the body.

Analyze the motion graph/trajectory to identify the end of small movement arcs, gestures, or pose transitions.

At these points, introduce brief pauses or holds that allow the resulting negative body space to become visually noticeable.

The pauses should be movement-aware, rather than occurring at arbitrary fixed intervals.

Range: 0–100%

* 0% = original continuous movement.
* Higher values = increasingly frequent and/or pronounced pauses at meaningful movement endpoints.
* 100% = strongest emphasis on external body space, with pronounced holds at detected gesture/trajectory endpoints.

Apply to:

* Whole Body
* Left Arm
* Right Arm
* Left Leg
* Right Leg

⸻

6. Shifting Relation

Use the same Shifting Relation visual representation found in NO.60 Elements.

Purpose: Increase dynamic contrast between different body parts.

Continuously analyze which body part currently has the strongest or most significant movement.

As the Shifting Relation value increases:

* Emphasize the movement of the currently dominant body part.
* Reduce or slow movement in less-dominant body parts.
* Dynamically transfer the emphasis when another body part becomes dominant.

This should create a shifting hierarchy of movement so the viewer’s attention is directed toward one primary action at a time.

Range: 0–100%

* 0% = original balance between body parts.
* 100% = maximum contrast, where one body part can be highly dynamic while the others become significantly slower/subdued.

Apply to:

* Whole Body only

⸻

7. Body Modification

Add spatial body-twisting controls.

Allow the user to twist/rotate the selected body region around:

* X Axis
* Y Axis
* Z Axis
* XYZ / All Axes

The modification should support rotation/twisting through a 360° range while preserving sensible skeletal relationships and joint continuity.

Provide separate axis controls where useful so X, Y, and Z can be adjusted independently.

Apply to:

* Whole Body
* Torso / Body only
* Left Arm
* Right Arm
* Left Leg
* Right Leg

The Original comparison avatar must remain unaffected by these transformations.

⸻

Information / Explanation System

Add a small (i) information icon beside each modification element.

When the user clicks (i), open a dismissible information panel/popover explaining:

1. What the element represents
2. What changing the slider does visually
3. How the movement is computationally modified
4. Which body regions can be affected
5. Any important behavior at 0% and 100%

The explanation should use accessible language first, followed by a short technical explanation where appropriate.

For example, Circle + Curve could explain that the system analyzes joint trajectories over time and applies trajectory smoothing, curve fitting, or straightening algorithms according to the selected intensity.

The information panel must have a clear Close / × control.

⸻

Interaction Requirements

All modifications should:

* Update the Modified avatar in real time.
* Leave the Original avatar unchanged.
* Preserve the original animation as the source/reference motion.
* Allow multiple modification elements to be active simultaneously.
* Keep both comparison avatars synchronized on the same animation timeline whenever possible.
* Support play, pause, restart, and scrubbing so the same moment can be compared between Original and Modified.
* Make transitions between slider values smooth enough for users to experiment interactively.

