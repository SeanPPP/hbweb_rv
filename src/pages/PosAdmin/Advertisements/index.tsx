import { UploadOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  DatePicker,
  Form,
  Image,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Upload,
} from 'antd'
import type { UploadProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { SorterResult, TablePaginationConfig } from 'antd/es/table/interface'
import dayjs, { type Dayjs } from 'dayjs'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  createAdvertisement,
  deleteAdvertisement,
  enableAdvertisement,
  getAdvertisementById,
  getAdvertisementGrid,
  updateAdvertisement,
  uploadAdvertisementAsset,
} from '../../../services/advertisementService'
import { getActiveStores } from '../../../services/storeService'
import { useAuthStore } from '../../../store/auth'
import type {
  AdvertisementDetailDto,
  AdvertisementListDto,
  AdvertisementMediaType,
  AdvertisementSortModelItemDto,
  AdvertisementUpsertDto,
} from '../../../types/advertisement'
import { RequestError } from '../../../utils/request'

type DataType = AdvertisementListDto & { key: string }
type AdvertisementScopeType = 'all' | 'selected'

interface UploadedDraft {
  mediaUrl: string
  objectKey: string
  originalFileName: string
  contentType: string
  fileSize: number
}

interface AdvertisementEditorValues {
  title: string
  description?: string
  mediaType: AdvertisementMediaType
  mediaUrl: string
  thumbnailUrl?: string
  objectKey: string
  originalFileName: string
  contentType: string
  fileSize: number
  effectiveRange?: [Dayjs | null, Dayjs | null]
  isEnabled: boolean
  sortOrder: number
  scopeType: AdvertisementScopeType
  stores: string[]
}

function normalizeMediaType(value?: string): AdvertisementMediaType {
  return value?.toLowerCase() === 'video' ? 'video' : 'image'
}

function detectMediaType(file: Pick<File, 'name' | 'type'>): AdvertisementMediaType | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'

  const lowerName = file.name.toLowerCase()
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lowerName)) return 'image'
  if (/\.(mp4|webm|mov|m4v|avi)$/i.test(lowerName)) return 'video'
  return null
}

function formatFileSize(value?: number) {
  if (!value || !Number.isFinite(value)) return '-'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof RequestError && error.message) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function isFormValidationError(error: unknown): error is { errorFields: unknown[] } {
  return Boolean(error && typeof error === 'object' && 'errorFields' in error)
}

function toEditorValues(dto: AdvertisementDetailDto): AdvertisementEditorValues {
  return {
    title: dto.title,
    description: dto.description,
    mediaType: normalizeMediaType(dto.mediaType),
    mediaUrl: dto.mediaUrl,
    thumbnailUrl: dto.thumbnailUrl,
    objectKey: dto.objectKey,
    originalFileName: dto.originalFileName,
    contentType: dto.contentType,
    fileSize: dto.fileSize,
    effectiveRange: [
      dto.effectiveStart ? dayjs(dto.effectiveStart) : null,
      dto.effectiveEnd ? dayjs(dto.effectiveEnd) : null,
    ],
    isEnabled: dto.isEnabled,
    sortOrder: dto.sortOrder ?? 0,
    scopeType: dto.stores.length ? 'selected' : 'all',
    stores: dto.stores.map((store) => store.storeCode),
  }
}

function createDefaultEditorValues(): AdvertisementEditorValues {
  return {
    title: '',
    description: '',
    mediaType: 'image',
    mediaUrl: '',
    thumbnailUrl: '',
    objectKey: '',
    originalFileName: '',
    contentType: '',
    fileSize: 0,
    effectiveRange: undefined,
    isEnabled: true,
    sortOrder: 0,
    scopeType: 'all',
    stores: [],
  }
}

export default function AdvertisementsPage() {
  const { t } = useTranslation()
  const access = useAuthStore((state) => state.access)
  const [form] = Form.useForm()
  const [editorForm] = Form.useForm<AdvertisementEditorValues>()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<DataType[]>([])
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)
  const [sortField, setSortField] = useState<string | undefined>()
  const [sortOrder, setSortOrder] = useState<'ascend' | 'descend' | undefined>()
  const [storeOptions, setStoreOptions] = useState<{ label: string; value: string }[]>([])
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [uploadedAsset, setUploadedAsset] = useState<UploadedDraft | null>(null)
  const inFlightRef = useRef(false)

  const canEdit = access.canEditAdvertisements
  const scopeType = Form.useWatch('scopeType', editorForm) ?? 'all'
  const currentMediaType = Form.useWatch('mediaType', editorForm) ?? 'image'

  // 统一处理列表请求，避免筛选、分页、排序的入参在多个地方分叉。
  const loadData = async (nextPage = page, nextPageSize = pageSize) => {
    if (inFlightRef.current) return

    inFlightRef.current = true
    try {
      setLoading(true)
      const values = form.getFieldsValue()
      const sortModel: AdvertisementSortModelItemDto[] = []
      if (sortField && sortOrder) {
        sortModel.push({ ColId: sortField, Sort: sortOrder === 'ascend' ? 'asc' : 'desc' })
      }

      const result = await getAdvertisementGrid({
        title: values.title || undefined,
        storeCode: values.storeCode || undefined,
        mediaType: values.mediaType || undefined,
        isEnabled: values.isEnabled,
        pageNumber: nextPage,
        pageSize: nextPageSize,
        startRow: (nextPage - 1) * nextPageSize,
        endRow: nextPage * nextPageSize - 1,
        sortModel: sortModel.length ? sortModel : undefined,
      })
      setTotal(result.total)
      setData(result.items.map((item) => ({ ...item, key: item.id })))
    } catch (error) {
      message.error(getErrorMessage(error, t('message.loadFailed')))
    } finally {
      setLoading(false)
      inFlightRef.current = false
    }
  }

  const resetEditor = () => {
    setEditingId(null)
    setUploadedAsset(null)
    editorForm.resetFields()
    editorForm.setFieldsValue(createDefaultEditorValues())
  }

  const openCreate = () => {
    resetEditor()
    setEditorOpen(true)
  }

  const openEdit = async (id: string) => {
    resetEditor()
    try {
      const dto = await getAdvertisementById(id)
      setEditingId(id)
      setUploadedAsset({
        mediaUrl: dto.mediaUrl,
        objectKey: dto.objectKey,
        originalFileName: dto.originalFileName,
        contentType: dto.contentType,
        fileSize: dto.fileSize,
      })
      editorForm.setFieldsValue(toEditorValues(dto))
      setEditorOpen(true)
    } catch (error) {
      message.error(getErrorMessage(error, t('advertisements.messages.loadDetailFailed')))
    }
  }

  const saveEditor = async () => {
    try {
      const values = await editorForm.validateFields()
      const [effectiveStart, effectiveEnd] = values.effectiveRange ?? []
      const scopeStores = values.scopeType === 'selected' ? values.stores || [] : []

      if (values.scopeType === 'selected' && scopeStores.length === 0) {
        await editorForm.validateFields(['stores'])
        return
      }

      const payload: AdvertisementUpsertDto = {
        title: values.title,
        description: values.description || undefined,
        mediaType: values.mediaType,
        mediaUrl: values.mediaUrl,
        thumbnailUrl: values.thumbnailUrl || undefined,
        objectKey: values.objectKey,
        originalFileName: values.originalFileName,
        contentType: values.contentType,
        fileSize: Number(values.fileSize || 0),
        effectiveStart: effectiveStart?.toISOString() || '',
        effectiveEnd: effectiveEnd?.toISOString() || '',
        isEnabled: !!values.isEnabled,
        sortOrder: Number(values.sortOrder || 0),
        stores: scopeStores.map((storeCode) => ({ storeCode })),
      }

      setSaving(true)
      if (editingId) {
        await updateAdvertisement(editingId, payload)
      } else {
        await createAdvertisement(payload)
      }
      message.success(t('message.saveSuccess'))
      setEditorOpen(false)
      await loadData()
    } catch (error) {
      if (isFormValidationError(error)) {
        return
      }
      message.error(getErrorMessage(error, t('message.saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteAdvertisement(id)
      message.success(t('message.deleteSuccess'))
      await loadData()
    } catch (error) {
      message.error(getErrorMessage(error, t('message.deleteFailed')))
    }
  }

  const toggleEnable = async (record: DataType, enable: boolean) => {
    try {
      await enableAdvertisement(record.id, enable)
      message.success(t('advertisements.messages.toggleSuccess'))
      await loadData()
    } catch (error) {
      message.error(getErrorMessage(error, t('message.updateFailed')))
    }
  }

  // 上传成功后把后端返回的对象键、访问地址和元数据一次性写回表单。
  const uploadProps: UploadProps = {
    accept: 'image/*,video/mp4,video/webm,video/quicktime,video/x-m4v,video/avi',
    maxCount: 1,
    showUploadList: false,
    disabled: !canEdit,
    beforeUpload: async (file) => {
      const mediaType = detectMediaType(file)
      if (!mediaType) {
        message.error(t('advertisements.validation.fileType'))
        return Upload.LIST_IGNORE
      }

      try {
        setUploading(true)
        const uploaded = await uploadAdvertisementAsset(file)
        setUploadedAsset(uploaded)
        editorForm.setFieldsValue({
          mediaType,
          mediaUrl: uploaded.mediaUrl,
          thumbnailUrl: mediaType === 'image'
            ? uploaded.mediaUrl
            : editorForm.getFieldValue('thumbnailUrl'),
          objectKey: uploaded.objectKey,
          originalFileName: uploaded.originalFileName,
          contentType: uploaded.contentType,
          fileSize: uploaded.fileSize,
        })
        message.success(t('advertisements.messages.uploadSuccess'))
      } catch (error) {
        message.error(getErrorMessage(error, t('advertisements.messages.uploadFailed')))
      } finally {
        setUploading(false)
      }

      return Upload.LIST_IGNORE
    },
  }

  const columns: ColumnsType<DataType> = [
    {
      title: t('advertisements.columns.title'),
      dataIndex: 'title',
      key: 'title',
      sorter: true,
      width: 220,
    },
    {
      title: t('advertisements.columns.preview'),
      key: 'preview',
      width: 150,
      render: (_, record) => {
        const previewUrl = record.thumbnailUrl || record.mediaUrl
        return normalizeMediaType(record.mediaType) === 'image'
          ? (
              <Image
                src={previewUrl}
                width={112}
                height={64}
                style={{ objectFit: 'cover', borderRadius: 6 }}
              />
            )
          : (
              <video
                src={record.mediaUrl}
                poster={record.thumbnailUrl || undefined}
                style={{ width: 112, height: 64, objectFit: 'cover', borderRadius: 6 }}
                muted
              />
            )
      },
    },
    {
      title: t('advertisements.columns.mediaType'),
      dataIndex: 'mediaType',
      key: 'mediaType',
      sorter: true,
      width: 110,
      render: (value: AdvertisementMediaType) => (
        <Tag color={normalizeMediaType(value) === 'video' ? 'purple' : 'blue'}>
          {t(`advertisements.mediaTypes.${normalizeMediaType(value)}`)}
        </Tag>
      ),
    },
    {
      title: t('advertisements.columns.isEnabled'),
      dataIndex: 'isEnabled',
      key: 'isEnabled',
      sorter: true,
      width: 110,
      render: (_, record) => (
        <Switch checked={record.isEnabled} disabled={!canEdit} onChange={(checked) => void toggleEnable(record, checked)} />
      ),
    },
    {
      title: t('advertisements.columns.effectiveRange'),
      key: 'effectiveRange',
      width: 260,
      render: (_, record) => (
        `${record.effectiveStart ? dayjs(record.effectiveStart).format('YYYY-MM-DD HH:mm') : '-'} - ${record.effectiveEnd ? dayjs(record.effectiveEnd).format('YYYY-MM-DD HH:mm') : '-'}`
      ),
    },
    {
      title: t('advertisements.columns.stores'),
      key: 'stores',
      width: 220,
      render: (_, record) => (
        record.stores.length
          ? record.stores.map((store) => <Tag key={store.storeCode}>{store.storeCode}</Tag>)
          : <Tag color="blue">{t('advertisements.scope.allStores')}</Tag>
      ),
    },
    {
      title: t('advertisements.columns.sortOrder'),
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      sorter: true,
      width: 110,
    },
    {
      title: t('column.action'),
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => void openEdit(record.id)}>
            {canEdit ? t('common.edit') : t('common.view')}
          </Button>
          {canEdit ? (
            <Popconfirm
              title={t('advertisements.confirmDelete')}
              okText={t('common.delete')}
              cancelText={t('common.cancel')}
              okButtonProps={{ danger: true }}
              onConfirm={() => void handleDelete(record.id)}
            >
              <Button type="link" danger>{t('common.delete')}</Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ]

  const onTableChange = (
    pagination: TablePaginationConfig,
    _filters: Record<string, unknown>,
    sorter: SorterResult<DataType> | SorterResult<DataType>[],
  ) => {
    const nextPage = pagination.current ?? 1
    const nextPageSize = pagination.pageSize ?? pageSize
    setPage(nextPage)
    setPageSize(nextPageSize)

    const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter
    if (activeSorter?.field) {
      setSortField(String(activeSorter.field))
      setSortOrder(activeSorter.order ?? undefined)
    } else {
      setSortField(undefined)
      setSortOrder(undefined)
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        setStoreOptions(await getActiveStores())
      } catch {
        setStoreOptions([])
      }
      await loadData(1, pageSize)
    })()
  }, [])

  useEffect(() => {
    void loadData(page, pageSize)
  }, [page, pageSize, sortField, sortOrder])

  return (
    <Card
      title={t('advertisements.title')}
      extra={canEdit ? <Button type="primary" onClick={openCreate}>{t('advertisements.actions.create')}</Button> : null}
    >
      <Form
        form={form}
        layout="inline"
        onFinish={() => {
          setPage(1)
          void loadData(1, pageSize)
        }}
        style={{ marginBottom: 16 }}
      >
        <Form.Item name="title" label={t('advertisements.filters.title')}>
          <Input allowClear placeholder={t('advertisements.filters.titlePlaceholder')} style={{ width: 220 }} />
        </Form.Item>
        <Form.Item name="storeCode" label={t('advertisements.filters.store')}>
          <Select allowClear showSearch optionFilterProp="label" options={storeOptions} style={{ width: 220 }} />
        </Form.Item>
        <Form.Item name="mediaType" label={t('advertisements.filters.mediaType')}>
          <Select
            allowClear
            style={{ width: 160 }}
            options={[
              { label: t('advertisements.mediaTypes.image'), value: 'image' },
              { label: t('advertisements.mediaTypes.video'), value: 'video' },
            ]}
          />
        </Form.Item>
        <Form.Item name="isEnabled" label={t('advertisements.filters.status')}>
          <Select
            allowClear
            style={{ width: 140 }}
            options={[
              { label: t('advertisements.status.enabled'), value: true },
              { label: t('advertisements.status.disabled'), value: false },
            ]}
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">{t('common.query')}</Button>
            <Button
              onClick={() => {
                form.resetFields()
                setPage(1)
                void loadData(1, pageSize)
              }}
            >
              {t('common.reset')}
            </Button>
          </Space>
        </Form.Item>
      </Form>

      <Table
        rowKey="key"
        loading={loading}
        dataSource={data}
        columns={columns}
        pagination={{ total, current: page, pageSize, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'] }}
        onChange={onTableChange}
      />

      <Modal
        open={editorOpen}
        title={editingId ? t('advertisements.editor.editTitle') : t('advertisements.editor.createTitle')}
        onCancel={() => setEditorOpen(false)}
        onOk={() => void saveEditor()}
        okButtonProps={{ disabled: !canEdit, loading: saving || uploading }}
        width={920}
        forceRender
      >
        <Form form={editorForm} layout="vertical" disabled={!canEdit}>
          <Space style={{ width: '100%' }} wrap>
            <Form.Item
              name="title"
              label={t('advertisements.fields.title')}
              rules={[{ required: true, message: t('advertisements.validation.title') }]}
              style={{ width: 300 }}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="mediaType"
              label={t('advertisements.fields.mediaType')}
              rules={[{ required: true }]}
              style={{ width: 160 }}
            >
              <Select
                options={[
                  { label: t('advertisements.mediaTypes.image'), value: 'image' },
                  { label: t('advertisements.mediaTypes.video'), value: 'video' },
                ]}
              />
            </Form.Item>
            <Form.Item name="sortOrder" label={t('advertisements.fields.sortOrder')} style={{ width: 140 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="isEnabled" label={t('advertisements.fields.isEnabled')} valuePropName="checked" style={{ width: 120 }}>
              <Switch />
            </Form.Item>
          </Space>

          <Form.Item name="description" label={t('advertisements.fields.description')}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item label={t('advertisements.fields.asset')}>
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />} loading={uploading} disabled={!canEdit}>
                  {t('advertisements.actions.upload')}
                </Button>
              </Upload>
              {uploadedAsset ? (
                <Tag color="blue">
                  {uploadedAsset.originalFileName} / {formatFileSize(uploadedAsset.fileSize)}
                </Tag>
              ) : (
                <Tag>{t('advertisements.empty.noAsset')}</Tag>
              )}
              {uploadedAsset ? (
                currentMediaType === 'image'
                  ? <Image src={uploadedAsset.mediaUrl} width={220} style={{ borderRadius: 8 }} />
                  : (
                      <video
                        src={uploadedAsset.mediaUrl}
                        controls
                        style={{ width: 320, maxWidth: '100%', borderRadius: 8 }}
                      />
                    )
              ) : null}
            </Space>
          </Form.Item>

          <Space style={{ width: '100%' }} wrap>
            <Form.Item
              name="mediaUrl"
              label={t('advertisements.fields.mediaUrl')}
              rules={[{ required: true, message: t('advertisements.validation.mediaUrl') }]}
              style={{ width: 420 }}
            >
              <Input disabled />
            </Form.Item>
            <Form.Item
              name="thumbnailUrl"
              label={t('advertisements.fields.thumbnailUrl')}
              style={{ width: 420 }}
            >
              <Input placeholder={t('advertisements.fields.thumbnailUrl')} />
            </Form.Item>
          </Space>

          <Space style={{ width: '100%' }} wrap>
            <Form.Item
              name="objectKey"
              label={t('advertisements.fields.objectKey')}
              rules={[{ required: true }]}
              style={{ width: 300 }}
            >
              <Input disabled />
            </Form.Item>
            <Form.Item
              name="originalFileName"
              label={t('advertisements.fields.originalFileName')}
              rules={[{ required: true }]}
              style={{ width: 220 }}
            >
              <Input disabled />
            </Form.Item>
            <Form.Item
              name="contentType"
              label={t('advertisements.fields.contentType')}
              rules={[{ required: true }]}
              style={{ width: 220 }}
            >
              <Input disabled />
            </Form.Item>
            <Form.Item
              name="fileSize"
              label={t('advertisements.fields.fileSize')}
              rules={[{ required: true }]}
              style={{ width: 140 }}
            >
              <InputNumber disabled style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Form.Item
            name="effectiveRange"
            label={t('advertisements.fields.effectiveRange')}
            rules={[{ required: true, message: t('advertisements.validation.effectiveRange') }]}
          >
            <DatePicker.RangePicker showTime style={{ width: 420 }} />
          </Form.Item>

          <Form.Item label={t('advertisements.fields.scopeType')}>
            <Form.Item name="scopeType" noStyle>
              <Segmented<AdvertisementScopeType>
                options={[
                  { label: t('advertisements.scope.allStores'), value: 'all' },
                  { label: t('advertisements.scope.selectedStores'), value: 'selected' },
                ]}
              />
            </Form.Item>
          </Form.Item>

          {scopeType === 'all' ? (
            <div style={{ marginBottom: 16 }}>
              <Tag color="blue">{t('advertisements.scope.allStoresHint')}</Tag>
            </div>
          ) : null}

          <Form.Item
            name="stores"
            label={t('advertisements.fields.stores')}
            rules={scopeType === 'selected' ? [{ required: true, message: t('advertisements.validation.stores') }] : []}
          >
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              options={storeOptions}
              placeholder={scopeType === 'selected' ? t('advertisements.scope.selectedStoresHint') : t('advertisements.scope.allStoresHint')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
