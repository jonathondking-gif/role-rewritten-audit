export default function Logo() {
  return (
    <a
      href="https://www.rolerewritten.com"
      className="flex items-center"
      aria-label="Role Rewritten home"
    >
      <svg
        width="36"
        height="36"
        viewBox="0 0 48 48"
        aria-hidden="true"
        style={{ marginRight: 10 }}
      >
        <rect width="48" height="48" rx="12" fill="#1D6FE0" />
        <path d="M14 10 H29 L36 17 V38 H14 Z" fill="#fff" />
        <path
          d="M19 22 H31 M19 27 H31 M19 32 H26"
          stroke="#BFD6FB"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M26 33 L30 37 L38 27"
          fill="none"
          stroke="#0D2A4C"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
        <span style={{ color: "#0D2A4C" }}>Role</span>{" "}
        <span style={{ color: "#1D6FE0" }}>Rewritten</span>
      </span>
    </a>
  );
}
