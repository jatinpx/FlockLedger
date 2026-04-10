export default function LoginTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="page-transition-enter">{children}</div>;
}
