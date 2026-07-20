export type PromptPreset = { value: string; label: string; fragment: string };

export const SLIDE_PURPOSE_PRESETS: PromptPreset[] = [
  { value: "hook", label: "Hook / Opener", fragment: "This is the attention-grabbing opening slide — make it visually striking and immediately relatable." },
  { value: "problem", label: "Problem / Pain Point", fragment: "This slide should visually represent a common frustration or struggle the viewer relates to." },
  { value: "before", label: "Before", fragment: "This slide represents the 'before' state — show an authentic, unpolished starting point." },
  { value: "after", label: "After", fragment: "This slide represents the 'after' or improved state — show visible positive change and confidence." },
  { value: "transformation", label: "Transformation", fragment: "This slide should convey visible physical transformation and progress over time." },
  { value: "tip", label: "Tip / Educational", fragment: "This slide illustrates a practical tip or piece of advice in a clear, simple visual." },
  { value: "testimonial", label: "Testimonial / Social Proof", fragment: "This slide should feel like a real, authentic personal moment that supports a testimonial." },
  { value: "cta", label: "Call To Action", fragment: "This is the closing slide and should feel inviting and motivating, encouraging the viewer to take the next step." },
];

export const REFERENCE_TYPE_PRESETS: PromptPreset[] = [
  { value: "mirror_selfie", label: "Mirror Selfie", fragment: "Style the shot as a candid mirror selfie, phone visible in frame, authentic gym or bedroom setting." },
  { value: "gym_photo", label: "Gym Photo", fragment: "Style the shot as an authentic gym environment photo with realistic equipment and lighting." },
  { value: "progress_photo", label: "Progress Photo", fragment: "Style the shot as a straightforward progress photo with a neutral background and consistent framing." },
  { value: "outdoor_photo", label: "Outdoor Photo", fragment: "Style the shot as a natural outdoor setting with daylight." },
  { value: "product_shot", label: "Product Shot", fragment: "Style the shot as a clean product photo with a simple, uncluttered background." },
  { value: "candid_lifestyle", label: "Candid Lifestyle", fragment: "Style the shot as a candid, unposed lifestyle moment." },
];

export const VARIATION_ANGLE_PRESETS: PromptPreset[] = [
  { value: "shirt_too_tight", label: "Clothes Don't Fit Like They Used To", fragment: "Emphasize the emotional angle of clothes feeling too tight or uncomfortable." },
  { value: "out_of_breath", label: "Out Of Breath Easily", fragment: "Emphasize the angle of feeling winded or low on stamina during simple activities." },
  { value: "low_energy", label: "Low Energy / Fatigue", fragment: "Emphasize the angle of feeling tired and low on energy throughout the day." },
  { value: "mirror_avoidance", label: "Avoiding The Mirror", fragment: "Emphasize the emotional angle of avoiding mirrors or photos." },
  { value: "confidence_boost", label: "Confidence Boost", fragment: "Emphasize the angle of renewed confidence and self-image." },
  { value: "energy_increase", label: "Increased Energy", fragment: "Emphasize the angle of noticeably higher energy and stamina." },
  { value: "social_comparison", label: "Comparing To Others", fragment: "Emphasize the relatable angle of comparing progress to others." },
  { value: "small_wins", label: "Celebrating Small Wins", fragment: "Emphasize the angle of small, consistent daily wins adding up." },
];

export function findPreset(presets: PromptPreset[], value: string): PromptPreset | undefined {
  return presets.find((p) => p.value === value);
}
