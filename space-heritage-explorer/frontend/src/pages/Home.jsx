export default function Home({ onNavigate }) {
  return (
    <div className="home">
      <section className="hero">
        <p className="eyebrow">An interactive 3D journey</p>
        <h1>What humans left on other worlds</h1>
        <p className="lead">
          Explore the landing sites of Apollo, Chandrayaan-3, Chang'e, Viking, Curiosity,
          Perseverance and more. Spin the planet, tap a site and see what's still sitting there.
        </p>
      </section>

      <section className="worldcards">
        <button className="worldcard" onClick={() => onNavigate("moon")}>
          <span className="orb moon" />
          <h2>The Moon</h2>
          <p>14 landing sites · Apollo, India, USSR, China</p>
          <b>Explore the Moon →</b>
        </button>
        <button className="worldcard" onClick={() => onNavigate("mars")}>
          <span className="orb mars" />
          <h2>Mars</h2>
          <p>13 landing sites · rovers, landers and failed missions</p>
          <b>Explore Mars →</b>
        </button>
      </section>

      <button className="chatcta missioncta" onClick={() => onNavigate("mission")}>
        <span className="chatcta-icon" aria-hidden="true">🚀</span>
        <span className="chatcta-text">
          <strong>Mission Lab</strong>
          <small>Sit in the capsule, launch from Earth, fly to the Moon and walk at Tranquility Base.</small>
        </span>
        <b>Launch the mission →</b>
      </button>

      <button className="chatcta" onClick={() => onNavigate("chat")}>
        <span className="chatcta-icon" aria-hidden="true">💬</span>
        <span className="chatcta-text">
          <strong>Chat with AI</strong>
          <small>Ask any question about the Moon or Mars. Answers come from NASA sources.</small>
        </span>
        <b>Start chatting →</b>
      </button>
    </div>
  );
}