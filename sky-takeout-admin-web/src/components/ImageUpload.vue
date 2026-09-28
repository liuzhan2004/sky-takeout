<template>
  <div class="image-upload">
    <el-upload
      v-if="!modelValue"
      :http-request="handleUpload"
      :before-upload="beforeUpload"
      :show-file-list="false"
      accept="image/*"
    >
      <div class="upload-placeholder">
        <el-icon :size="24"><Plus /></el-icon>
        <span>上传图片</span>
      </div>
    </el-upload>
    <div v-else class="upload-preview">
      <el-image
        :src="previewUrl"
        :preview-src-list="[previewUrl]"
        fit="cover"
        preview-teleported
      />
      <div class="upload-actions">
        <el-button link type="danger" @click.stop="removeImage">
          删除图片
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'

import { uploadFile } from '@/api/common'
import { toFileUrl } from '@/utils/format'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue'])

const previewUrl = computed(() => toFileUrl(props.modelValue))

function beforeUpload(file) {
  const isImage = file.type.startsWith('image/')
  if (!isImage) {
    ElMessage.error('只能上传图片文件')
    return false
  }
  if (file.size / 1024 / 1024 > 5) {
    ElMessage.error('图片大小不能超过 5MB')
    return false
  }
  return true
}

async function handleUpload(options) {
  try {
    const res = await uploadFile(options.file)
    if (res?.code === 1) {
      emit('update:modelValue', res.data)
      ElMessage.success('上传成功')
      options.onSuccess(res)
    } else {
      throw new Error(res?.msg || '上传失败')
    }
  } catch (error) {
    options.onError(error)
  }
}

function removeImage() {
  emit('update:modelValue', '')
}
</script>

<style scoped>
.image-upload {
  display: inline-block;
}

.upload-placeholder {
  width: 148px;
  height: 148px;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #8c939d;
  cursor: pointer;
  background: #fafafa;
  transition: border-color 0.2s;
}

.upload-placeholder:hover {
  border-color: #409eff;
  color: #409eff;
}

.upload-preview {
  position: relative;
  width: 148px;
  height: 148px;
  border-radius: 6px;
  overflow: hidden;
}

.upload-preview :deep(.el-image) {
  width: 100%;
  height: 100%;
  display: block;
}

.upload-actions {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  justify-content: center;
}

.upload-actions :deep(.el-button) {
  color: #fff;
}
</style>
