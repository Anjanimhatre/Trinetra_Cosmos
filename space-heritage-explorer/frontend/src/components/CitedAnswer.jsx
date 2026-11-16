// Use in NasaChat where you show the answer:  <CitedAnswer answer={msg.content} sources={msg.sources} />
export default function CitedAnswer({ answer = "", sources = [] }) {
  const byNumber = new Map(sources.map((s) => [s.n, s]));
  const nodes = [];
  const re = /\[SOURCE (\d+)\]/g;
  let last = 0;
  let m;
  while ((m = re.exec(answer)) !== null) {
    nodes.push(answer.slice(last, m.index));
    const s = byNumber.get(Number(m[1]));
    if (s && /^https:\/\//.test(s.url)) {
      nodes.push(
        <a
          key={m.index}
          className="cite"
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`${s.organisation ? s.organisation + ": " : ""}${s.title}`}
        >
          [{s.n}]
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  nodes.push(answer.slice(last));
  return <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{nodes}</p>;
}