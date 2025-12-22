import { NextResponse } from 'next/server';
import Sts20150401, * as $Sts20150401 from '@alicloud/sts20150401';
import * as $OpenApi from '@alicloud/openapi-client';
import { isAdmin } from '@/app/lib/auth';
import { errorResponse } from '@/app/lib';

export const dynamic = 'force-dynamic';

// STS 凭证有效期（秒），最小 900，最大 3600
const STS_DURATION_SECONDS = 900;

// OSS 配置
const OSS_CONFIG = {
  region: process.env.OSS_REGION || 'oss-cn-hangzhou',
  bucket: process.env.OSS_BUCKET || '',
  roleArn: process.env.OSS_ROLE_ARN || '',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
};

/**
 * 创建 STS 客户端
 */
function createStsClient(): Sts20150401 {
  const config = new $OpenApi.Config({
    accessKeyId: OSS_CONFIG.accessKeyId,
    accessKeySecret: OSS_CONFIG.accessKeySecret,
  });
  // STS 服务端点
  config.endpoint = 'sts.aliyuncs.com';
  return new Sts20150401(config);
}

/**
 * 生成上传路径前缀
 */
function generateUploadPath(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `images/${year}/${month}/`;
}

/**
 * GET /api/oss/sts - 获取 OSS 上传临时凭证
 */
export async function GET() {
  // 权限检查
  if (!(await isAdmin())) {
    return errorResponse('Unauthorized', 403);
  }

  // 验证配置
  if (!OSS_CONFIG.roleArn || !OSS_CONFIG.accessKeyId || !OSS_CONFIG.accessKeySecret) {
    console.error('[STS] Missing OSS STS configuration');
    return errorResponse('Server configuration error', 500);
  }

  try {
    const client = createStsClient();
    const uploadPath = generateUploadPath();

    // 限制上传路径的策略
    const policy = JSON.stringify({
      Version: '1',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['oss:PutObject'],
          Resource: [`acs:oss:*:*:${OSS_CONFIG.bucket}/${uploadPath}*`],
        },
      ],
    });

    const request = new $Sts20150401.AssumeRoleRequest({
      roleArn: OSS_CONFIG.roleArn,
      roleSessionName: `upload-${Date.now()}`,
      durationSeconds: STS_DURATION_SECONDS,
      policy,
    });

    const response = await client.assumeRole(request);
    const credentials = response.body?.credentials;

    if (!credentials) {
      throw new Error('Failed to get STS credentials');
    }

    return NextResponse.json({
      success: true,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        accessKeySecret: credentials.accessKeySecret,
        securityToken: credentials.securityToken,
        expiration: credentials.expiration,
      },
      config: {
        bucket: OSS_CONFIG.bucket,
        region: OSS_CONFIG.region,
        uploadPath,
      },
    });
  } catch (error) {
    console.error('[STS] Error:', error);
    return errorResponse('Failed to get upload credentials', 500);
  }
}
