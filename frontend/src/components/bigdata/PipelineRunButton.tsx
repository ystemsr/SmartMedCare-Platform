import React, { useState } from 'react';
import { Loader2, Zap } from 'lucide-react';
import { Button, confirm } from '@/components/ui';
import { runPipeline } from '../../api/bigdata';
import { message } from '../../utils/message';

interface PipelineRunButtonProps {
  running: boolean;
  canRun: boolean;
  onTriggered: () => void;
}

const PipelineRunButton: React.FC<PipelineRunButtonProps> = ({
  running,
  canRun,
  onTriggered,
}) => {
  const [submitting, setSubmitting] = useState(false);

  const handleClick = async () => {
    const ok = await confirm({
      title: '一键刷新全部数据',
      content:
        '将依次执行"业务库快照 → 统计数据集市 → 智能风险预测"三段流程，通常需要 2–5 分钟。运行期间你无需停留在此页面，系统会在后台完成。',
      okText: '立即开始',
      cancelText: '取消',
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      const res = await runPipeline();
      if (res.data?.reused) {
        message.info('已有一条流水线正在运行，无需重复触发');
      } else {
        message.success('已开始刷新，进度会自动更新');
      }
      onTriggered();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '触发失败');
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = !canRun || running || submitting;
  const label = running ? '刷新中…' : submitting ? '启动中…' : '一键刷新全部数据';

  return (
    <Button
      variant="primary"
      size="lg"
      startIcon={
        running || submitting ? (
          <Loader2 size={18} style={{ animation: 'smc-spin 0.9s linear infinite' }} />
        ) : (
          <Zap size={18} />
        )
      }
      onClick={handleClick}
      disabled={disabled}
    >
      {label}
    </Button>
  );
};

export default PipelineRunButton;
