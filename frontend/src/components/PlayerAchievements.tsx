import { Icon } from "../lib";
const badges = [
  {
    name: "First things first",
    description: "Complete your first quiz",
    icon: "Sparkles",
    target: 1,
  },
  {
    name: "Perfectly curious",
    description: "Score 100% on a quiz",
    icon: "Target",
    target: 100,
  },
  {
    name: "Finding your rhythm",
    description: "Complete five quizzes",
    icon: "Flame",
    target: 5,
  },
];
export default function PlayerAchievements({
  data,
  compact = false,
}: {
  data: any;
  compact?: boolean;
}) {
  return (
    <section className={`player-achievements ${compact ? "compact" : ""}`}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">SMALL WINS, WELL EARNED</span>
          <h2>Your milestones</h2>
        </div>
        <span>
          {data.achievements.length} of {badges.length} earned
        </span>
      </div>
      <div className="achievement-grid">
        {badges.map((badge) => {
          const earned = data.achievements.some(
            (item: any) => item.name === badge.name,
          );
          const progress =
            badge.target === 100
              ? data.bestAccuracy || 0
              : Math.min(data.total, badge.target);
          return (
            <article
              className={`achievement-card ${earned ? "earned" : ""}`}
              key={badge.name}
            >
              <span>
                <Icon name={badge.icon as any} size={28} />
                {!earned && <Icon name="Lock" size={12} />}
              </span>
              <h3>{badge.name}</h3>
              <p>{badge.description}</p>
              <b>
                {earned
                  ? "Earned"
                  : badge.target === 100
                    ? `Best accuracy: ${progress}%`
                    : `${progress} of ${badge.target} completed`}
              </b>
            </article>
          );
        })}
      </div>
    </section>
  );
}
