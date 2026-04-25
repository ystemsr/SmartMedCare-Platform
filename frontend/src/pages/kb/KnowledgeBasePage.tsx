import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Trash2,
  Upload,
  RotateCw,
  Search,
  FileText,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  X,
} from 'lucide-react';
import { Button, IconButton, Input } from '../../components/ui';
import { RefCard, RefPageHead, RefSectionLabel } from '../../components/ref';
import { message } from '../../utils/message';
import {
  deleteKBDocument,
  getKBRoles,
  listKBDocuments,
  previewKBSearch,
  uploadKBDocuments,
  type KBDocument,
  type KBPreviewHit,
  type KBUploadResult,
} from '../../api/kb';

const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  doctor: '医生',
  elder: '老人',
  family: '家属',
};

const STATUS_LABEL: Record<string, { text: string; color: string; bg: string }> = {
  pending: { text: '排队中', color: '#92723b', bg: '#fcefd9' },
  processing: { text: '处理中', color: '#2c7a7b', bg: '#d9f4f5' },
  ready: { text: '就绪', color: '#276749', bg: '#d7f2dc' },
  failed: { text: '失败', color: '#9b2c2c', bg: '#fcd5d5' },
  deleted: { text: '已删除', color: '#6b6b6b', bg: '#e6e6e6' },
};

function formatSize(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(iso: string): string {
  try {
    // Backend stores timestamps as naive UTC and serializes them without
    // a timezone suffix (e.g. "2026-04-24T07:14:53"). Without an explicit
    // "Z", `new Date(...)` interprets them as LOCAL time, which is wrong
    // on every client not in UTC. Tack on "Z" when the string doesn't
    // already carry timezone info so the browser converts to the user's
    // device timezone on display.
    const hasTz = /Z|[+-]\d{2}:?\d{2}$/.test(iso);
    const d = new Date(hasTz ? iso : `${iso}Z`);
    return d.toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const s = STATUS_LABEL[status] || { text: status, color: '#555', bg: '#eee' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 600,
        color: s.color,
        background: s.bg,
        letterSpacing: '0.02em',
      }}
    >
      {s.text}
    </span>
  );
};

const RoleTabs: React.FC<{
  roles: string[];
  active: string;
  onChange: (code: string) => void;
  counts: Record<string, number>;
}> = ({ roles, active, onChange, counts }) => (
  <div
    role="tablist"
    style={{
      display: 'inline-flex',
      gap: 2,
      padding: 4,
      background: 'var(--smc-surface-alt)',
      border: '1px solid var(--smc-border)',
      borderRadius: 999,
    }}
  >
    {roles.map((code) => {
      const isActive = code === active;
      return (
        <button
          key={code}
          role="tab"
          aria-selected={isActive}
          type="button"
          onClick={() => onChange(code)}
          style={{
            position: 'relative',
            padding: '7px 18px',
            fontSize: 13,
            fontWeight: 500,
            color: isActive ? 'var(--smc-text)' : 'var(--smc-text-3)',
            background: 'transparent',
            border: 0,
            borderRadius: 999,
            cursor: 'pointer',
            transition: 'color 0.2s ease',
          }}
        >
          {isActive && (
            <motion.span
              layoutId="kb-role-tab-pill"
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                background: 'var(--smc-surface)',
                borderRadius: 999,
                boxShadow: 'var(--smc-shadow-xs)',
                zIndex: 0,
              }}
              transition={{
                type: 'spring',
                stiffness: 420,
                damping: 34,
                mass: 0.7,
              }}
            />
          )}
          <span
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {ROLE_LABELS[code] || code}
            {counts[code] != null && (
              <span
                style={{
                  padding: '0 7px',
                  fontSize: 11,
                  borderRadius: 999,
                  background: isActive
                    ? 'var(--smc-surface-alt)'
                    : 'var(--smc-border)',
                  color: 'var(--smc-text-3)',
                  transition: 'background 0.2s ease',
                }}
              >
                {counts[code]}
              </span>
            )}
          </span>
        </button>
      );
    })}
  </div>
);

const DocumentRow: React.FC<{
  doc: KBDocument;
  onDelete: (doc: KBDocument) => void;
  deleting: boolean;
}> = ({ doc, onDelete, deleting }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 2fr) 80px 100px 110px 160px 40px',
      gap: 12,
      alignItems: 'center',
      padding: '12px 14px',
      background: 'var(--smc-surface)',
      border: '1px solid var(--smc-border)',
      borderRadius: 'var(--smc-r-md)',
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          flexShrink: 0,
          background: 'var(--smc-surface-alt)',
          border: '1px solid var(--smc-border)',
          borderRadius: 8,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--smc-text-3)',
        }}
      >
        <FileText size={16} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 500,
            color: 'var(--smc-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={doc.name}
        >
          {doc.name}
        </div>
        {doc.status === 'failed' && doc.error_message && (
          <div
            style={{
              fontSize: 11,
              color: '#c53030',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={doc.error_message}
          >
            {doc.error_message}
          </div>
        )}
      </div>
    </div>
    <div style={{ fontSize: 12, color: 'var(--smc-text-3)' }}>
      .{doc.file_type}
    </div>
    <div style={{ fontSize: 12, color: 'var(--smc-text-3)' }}>
      {formatSize(doc.size)}
    </div>
    <div style={{ fontSize: 12, color: 'var(--smc-text-3)' }}>
      {doc.chunk_count} 段
    </div>
    <div style={{ fontSize: 12, color: 'var(--smc-text-3)' }}>
      <div>{formatDate(doc.created_at)}</div>
      <StatusBadge status={doc.status} />
    </div>
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <IconButton
        aria-label="删除"
        title="删除"
        onClick={() => onDelete(doc)}
        disabled={deleting}
      >
        <Trash2 size={14} />
      </IconButton>
    </div>
  </div>
);

const KnowledgeBasePage: React.FC = () => {
  const [roles, setRoles] = useState<string[]>([]);
  const [extensions, setExtensions] = useState<string[]>([]);
  const [activeRole, setActiveRole] = useState<string>('admin');
  const [docs, setDocs] = useState<KBDocument[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /* --- Upload result banner (per-file outcome of the latest batch) --- */
  const [lastUpload, setLastUpload] = useState<KBUploadResult[] | null>(null);

  /* --- Drag & drop state ---
   * We use a counter rather than a boolean because dragenter/dragleave
   * fire once per nested child — without it, hovering over a button
   * inside the dropzone flickers the overlay on and off. */
  const dragCounterRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  /* --- Retrieval preview --- */
  const [previewQuery, setPreviewQuery] = useState('');
  const [previewHits, setPreviewHits] = useState<KBPreviewHit[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const acceptAttr = useMemo(
    () => extensions.map((e) => `.${e}`).join(','),
    [extensions],
  );
  const allowedExt = useMemo(
    () => new Set(extensions.map((e) => e.toLowerCase())),
    [extensions],
  );

  // Return the lowercase extension without the leading dot (empty string
  // if the filename has no recognisable extension).
  const pickExt = (name: string): string => {
    const dot = name.lastIndexOf('.');
    if (dot < 0 || dot === name.length - 1) return '';
    return name.slice(dot + 1).toLowerCase();
  };

  // Split a File[] into (accepted, rejected) based on the server's
  // supported_extensions list. Filter runs client-side so we can skip
  // the round-trip for drag-in garbage and surface a useful toast.
  const partitionFiles = (files: File[]) => {
    const accepted: File[] = [];
    const rejected: File[] = [];
    for (const f of files) {
      // accept everything when we don't know the list yet (first render)
      if (allowedExt.size === 0 || allowedExt.has(pickExt(f.name))) {
        accepted.push(f);
      } else {
        rejected.push(f);
      }
    }
    return { accepted, rejected };
  };

  const loadRoles = async () => {
    try {
      const res = await getKBRoles();
      setRoles(res.data.roles);
      setExtensions(res.data.supported_extensions);
      if (res.data.roles.length > 0 && !res.data.roles.includes(activeRole)) {
        setActiveRole(res.data.roles[0]);
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : '角色加载失败');
    }
  };

  const loadDocs = async () => {
    setLoading(true);
    try {
      // Pull all roles once so the role tabs can show counts alongside the
      // active tab's documents. Cheap enough — the list is metadata only.
      const all = await listKBDocuments();
      const items = all.data.items;
      const c: Record<string, number> = {};
      for (const d of items) {
        c[d.role_code] = (c[d.role_code] || 0) + 1;
      }
      setCounts(c);
      setDocs(items.filter((d) => d.role_code === activeRole));
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeRole) return;
    loadDocs();
    setPreviewHits(null);
    setPreviewQuery('');
    setLastUpload(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRole]);

  const triggerFilePick = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  };

  const runUpload = async (raw: File[]) => {
    if (raw.length === 0) return;
    // Filter unsupported formats client-side before hitting the network.
    const { accepted, rejected } = partitionFiles(raw);
    if (rejected.length > 0) {
      const names = rejected.map((f) => f.name).slice(0, 3).join('、');
      const more = rejected.length > 3 ? `等 ${rejected.length} 个` : '';
      message.error(`已跳过不支持的文件：${names}${more}`);
    }
    if (accepted.length === 0) return;

    setUploading(true);
    setLastUpload(null);
    try {
      const res = await uploadKBDocuments(activeRole, accepted);
      const items = res.data.items;
      const okCount = items.filter((x) => x.ok).length;
      const failCount = items.length - okCount;
      setLastUpload(items);
      if (failCount === 0) {
        message.success(`已上传并索引 ${okCount} 个文件`);
      } else if (okCount === 0) {
        message.error(`${failCount} 个文件处理失败`);
      } else {
        message.success(`成功 ${okCount} 个，失败 ${failCount} 个`);
      }
      await loadDocs();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files ? Array.from(e.target.files) : [];
    await runUpload(picked);
  };

  const resetDragState = () => {
    dragCounterRef.current = 0;
    setIsDragging(false);
  };

  const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    if (uploading) return;
    // Only respond when the drag carries files, not DOM fragments or text.
    if (!Array.from(e.dataTransfer?.types || []).includes('Files')) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsDragging(true);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (uploading) return;
    if (!Array.from(e.dataTransfer?.types || []).includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (uploading) return;
    e.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDragging(false);
  };

  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    resetDragState();
    if (uploading) return;
    const dropped = e.dataTransfer?.files
      ? Array.from(e.dataTransfer.files)
      : [];
    await runUpload(dropped);
  };

  const onDelete = async (doc: KBDocument) => {
    if (!window.confirm(`确定删除 ${doc.name} 吗？该操作不可恢复。`)) return;
    setDeletingId(doc.id);
    try {
      await deleteKBDocument(doc.id);
      message.success('已删除');
      await loadDocs();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  const runPreview = async () => {
    const q = previewQuery.trim();
    if (!q) return;
    setPreviewLoading(true);
    try {
      const res = await previewKBSearch(activeRole, q, 5);
      setPreviewHits(res.data.hits);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '检索失败');
      setPreviewHits([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  const roleLabel = ROLE_LABELS[activeRole] || activeRole;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <RefPageHead
        title="AI 知识库"
        subtitle="按角色管理检索增强（RAG）知识库内容，不同角色互相隔离"
        actions={
          roles.length > 0 && (
            <RoleTabs
              roles={roles}
              active={activeRole}
              onChange={setActiveRole}
              counts={counts}
            />
          )
        }
      />

      {lastUpload && lastUpload.length > 0 && (
        <div
          style={{
            padding: '14px 18px',
            background: 'var(--smc-surface)',
            border: '1px solid var(--smc-border)',
            borderRadius: 'var(--smc-r-lg)',
            boxShadow: 'var(--smc-shadow-xs)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--smc-text)',
              }}
            >
              上传结果 · 成功{' '}
              {lastUpload.filter((x) => x.ok).length} / 共{' '}
              {lastUpload.length}
            </div>
            <IconButton
              aria-label="关闭"
              title="关闭"
              onClick={() => setLastUpload(null)}
            >
              <X size={14} />
            </IconButton>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {lastUpload.map((item, i) => (
              <div
                key={`${i}-${item.name}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 10px',
                  background: item.ok
                    ? 'rgba(47, 133, 90, 0.06)'
                    : 'rgba(197, 48, 48, 0.06)',
                  borderRadius: 'var(--smc-r-sm, 8px)',
                  border: `1px solid ${
                    item.ok
                      ? 'rgba(47, 133, 90, 0.18)'
                      : 'rgba(197, 48, 48, 0.18)'
                  }`,
                }}
              >
                {item.ok ? (
                  <CheckCircle2 size={14} color="#2f855a" />
                ) : (
                  <AlertCircle size={14} color="#c53030" />
                )}
                <span
                  style={{
                    fontSize: 12.5,
                    color: 'var(--smc-text)',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    flexShrink: 0,
                    maxWidth: 320,
                  }}
                  title={item.name}
                >
                  {item.name}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--smc-text-3)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {item.ok
                    ? `已切分 ${item.document?.chunk_count ?? 0} 段`
                    : item.error || '处理失败'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        style={{ position: 'relative' }}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <AnimatePresence>
          {isDragging && (
            <motion.div
              key="kb-dropzone-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              // Pointer events stay enabled so drag events keep firing on
              // the overlay; nothing inside the overlay is clickable.
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 10,
                borderRadius: 'var(--smc-r-lg)',
                border: '2px dashed var(--smc-accent, #6b9467)',
                background: 'rgba(107, 148, 103, 0.08)',
                backdropFilter: 'blur(2px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                color: '#4e6a4a',
                fontWeight: 600,
                fontSize: 14,
                pointerEvents: 'none',
              }}
            >
              <UploadCloud size={36} strokeWidth={1.6} />
              <div>松开以上传到「{roleLabel}」知识库</div>
              <div style={{ fontSize: 12, fontWeight: 500, opacity: 0.7 }}>
                不支持的格式会被自动跳过
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      <RefCard
        title={`${roleLabel} · 文档列表`}
        subtitle={`支持 ${extensions.length > 0 ? extensions.map((e) => `.${e}`).join('、') : '多种格式'}；可一次选择多个文件，或直接把文件拖拽到此卡片`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={loadDocs} disabled={loading}>
              <RotateCw size={14} style={{ marginRight: 6 }} />
              刷新
            </Button>
            <Button onClick={triggerFilePick} loading={uploading}>
              <Upload size={14} style={{ marginRight: 6 }} />
              {uploading ? '上传中…' : '上传文档'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={acceptAttr || undefined}
              style={{ display: 'none' }}
              onChange={onFileChange}
            />
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 2fr) 80px 100px 110px 160px 40px',
              gap: 12,
              padding: '0 14px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--smc-text-3)',
            }}
          >
            <span>文档名称</span>
            <span>类型</span>
            <span>大小</span>
            <span>片段</span>
            <span>上传时间 / 状态</span>
            <span />
          </div>
          {loading ? (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                color: 'var(--smc-text-3)',
              }}
            >
              正在加载…
            </div>
          ) : docs.length === 0 ? (
            <div
              style={{
                padding: '40px 16px',
                textAlign: 'center',
                color: 'var(--smc-text-3)',
                fontSize: 13,
                border: '1px dashed var(--smc-border)',
                borderRadius: 'var(--smc-r-md)',
                background: 'var(--smc-surface-alt)',
              }}
            >
              {roleLabel} 还没有知识库内容。点击右上角「上传文档」或直接将文件拖拽到此处开始。
            </div>
          ) : (
            docs.map((d) => (
              <DocumentRow
                key={d.id}
                doc={d}
                onDelete={onDelete}
                deleting={deletingId === d.id}
              />
            ))
          )}
        </div>
      </RefCard>
      </div>

      <RefCard
        title="检索预览"
        subtitle="按当前角色的知识库执行一次检索，验证效果"
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Input
            placeholder={`输入问题，测试「${roleLabel}」知识库的检索效果…`}
            value={previewQuery}
            onChange={(e) => setPreviewQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                runPreview();
              }
            }}
          />
          <Button onClick={runPreview} loading={previewLoading}>
            <Search size={14} style={{ marginRight: 6 }} />
            检索
          </Button>
        </div>
        {previewHits !== null && (
          <div style={{ marginTop: 16 }}>
            <RefSectionLabel>Top {previewHits.length} 命中</RefSectionLabel>
            {previewHits.length === 0 ? (
              <div
                style={{
                  padding: 24,
                  textAlign: 'center',
                  color: 'var(--smc-text-3)',
                  fontSize: 13,
                }}
              >
                没有检索到相关内容。
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {previewHits.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 12,
                      background: 'var(--smc-surface-alt)',
                      border: '1px solid var(--smc-border)',
                      borderRadius: 'var(--smc-r-md)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 12,
                        color: 'var(--smc-text-3)',
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--smc-text)' }}>
                        [{i + 1}] {h.document_name || '未命名文档'}
                        {h.chunk_index != null && ` · 片段 #${h.chunk_index}`}
                      </span>
                      <span>相关度 {Math.round(h.score * 100)}%</span>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--smc-text-2)',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {h.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </RefCard>
    </div>
  );
};

export default KnowledgeBasePage;
