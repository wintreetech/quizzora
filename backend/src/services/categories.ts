import { categories } from "../shared/schemas.js";
import { Settings } from "../models.js";
import { HttpError } from "../utils.js";
export async function quizCategories(): Promise<string[]> {
  const stored = await Settings.findOne({ key: "quiz-categories-v1" });
  return [
    ...new Set<string>([
      ...categories,
      ...(Array.isArray(stored?.value?.custom) ? stored.value.custom : []),
    ]),
  ];
}
export async function validateQuizCategory(category: string) {
  if (!(await quizCategories()).includes(category))
    throw new HttpError(
      400,
      "Choose an available category. Administrators can add a category first.",
    );
}
