import { Link } from "react-router-dom";
import { useApp, Icon } from "../lib";
import QuizCatalogue from "../components/QuizCatalogue";
import { LandingGuide } from "./HowItWorks";
export default function Discover({ library = false }: { library?: boolean }) {
  const { user, auth } = useApp();
  return (
    <div className="explore-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {library ? "YOUR NEXT GOOD FIND" : "A WORLD OF GOOD QUESTIONS"}
          </span>
          <h1>
            {library ? "Your saved quizzes" : "Follow what makes you curious."}
          </h1>
          <p>
            {library
              ? "Every quiz you saved, with its current entry price and your progress."
              : "Choose a subject, find your level, and make a little time for discovery."}
          </p>
        </div>
        {user ? (
          <Link to="/dashboard" className="btn outline">
            My dashboard
          </Link>
        ) : (
          <button className="btn primary" onClick={() => auth("register")}>
            Start playing
          </button>
        )}
      </div>
      {!library && !user && (
        <section className="explore-intro">
          <div>
            <span className="eyebrow">YOUR NEXT FIVE MINUTES, WELL SPENT</span>
            <h2>
              A little knowledge.
              <br />
              <em>A lot to discover.</em>
            </h2>
            <p>
              Start with a free round, learn from every answer, and unlock
              premium subjects when you choose.
            </p>
            <Link to="/?tab=free#quiz-list" className="btn primary">
              Explore free quizzes
            </Link>
          </div>
          <div className="explore-intro-steps">
            {[
              [
                "Compass",
                "Find your subject",
                "Science, culture, logic and more.",
              ],
              [
                "Play",
                "Play at your level",
                "Beginner through advanced challenges.",
              ],
              [
                "Medal",
                "Make real progress",
                "Saved results, explanations and badges.",
              ],
            ].map(([icon, title, text]) => (
              <div key={title}>
                <span>
                  <Icon name={icon as any} size={24} />
                </span>
                <div>
                  <b>{title}</b>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      <QuizCatalogue library={library} />
      {!library && !user && <LandingGuide />}
    </div>
  );
}
