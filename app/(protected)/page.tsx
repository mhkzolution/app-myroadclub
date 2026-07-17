import { AccountMenu } from "../components/AccountMenu";
import { RoadsideHelpTabs } from "../components/RoadsideHelpTabs";

/** Brand logo (myroadclub.com) */
const MRC_LOGO_URL =
  "https://myroadclub.com/wp-content/uploads/2025/10/IMG_7802-300x300.png";

export default function Home() {
  return (
    <main className="app-shell">
      <div className="app-content">
        <section className="explore-hero">
          <div className="explore-hero-row">
            <div className="app-brand">
              <img
                className="app-brand-logo"
                src={MRC_LOGO_URL}
                alt="My Road Club"
                width={300}
                height={300}
              />
            </div>
            <h1 className="explore-greeting">
              Welcome to <span>My Road Club</span>
            </h1>
            <div className="explore-hero-actions">
              <AccountMenu />
            </div>
          </div>
        </section>

        <section className="roadside-section" aria-label="Roadside assistance">
          <RoadsideHelpTabs />
        </section>
      </div>
    </main>
  );
}
