export default function MainTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="page-transition-enter">{children}</div>;
}
