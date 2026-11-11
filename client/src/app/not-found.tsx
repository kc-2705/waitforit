import Link from 'next/link';
import { Button, Result } from 'antd';

export default function NotFound() {
  return (
    <div className="center">
      <Result status="404" title="Page not found" subTitle="That page doesn’t exist." extra={<Link href="/"><Button type="primary">Go home</Button></Link>} />
    </div>
  );
}
