const fs = require('fs-extra')
const path = require('path')
const { exec } = require('child_process')
const compressing = require('compressing')
const { argv } = require('optimist')
/** 从oss.js引入阿里云连接函数 */
const { createOss, ossHost } = require('./oss.js')

/** 根据命令行参数获取到本次打包部署的npm包工作目录 */
const target = path.resolve('../', argv.target)
console.log('工作目录: ', target)

/** 封装获取npm包工作目录下文件路径方法 */
const resolveTarget = file => path.join(target, file)
 /** 获取对应npm包文件下package.json的name和version，files，scripts字段。*/
const { name, version, files, scripts } = require(resolveTarget('package.json'))

/** 获取当前packages目录路径 */
const packagesPath = path.join(__dirname, './packages')
/** 如果没有packages文件就创建 */
if(!fs.existsSync(packagesPath)) fs.mkdirSync(packagesPath)
const resolvePackages = file => path.join(__dirname, './packages', file)
/** 在packages目录下npm包同名的文件夹路径 */
const destPath = resolvePackages(name)
const resolveDest = file => path.join(destPath, file)

/** 入口函数 */
function start() {
  if(scripts && scripts.build) {
    /** 借助node子进程child_process模块的exec方法在对应的npm包目录下执行打包操作 */
    exec('npm run build', { cwd: target }, function(err) {
      if(!err) {
        build()
      } else throw err
    })
  } else build()
}

start()

/** 开始打包部署上传 */
async function build() {
  /** 1. 检测在packages目录下是否有npm包同名的文件夹，有就删掉 */
  if(fs.existsSync(destPath)) fs.removeSync(destPath)
  /** 2. 然后再新建文件夹 */
  fs.mkdirSync(destPath)
  /** 3. 把package.json中的files文件列表复制到当前同名文件夹中(关键) */
  await Promise.all(files.map(file => fs.copy(resolveTarget(file), resolveDest(file))))
  /** 4. 定义tgz压缩包名称，为包名称-版本号.tgz */
  const tgzName = `${name}-${version}.tgz`
  /** 5. 定义tgz压缩包放置目录位置，放在packages文件下面 */
  const tgzPath = resolvePackages(tgzName)
  /** 6. 把npm包同名文件夹压缩为指定位置和名称的tgz包 */
  await compressing.tgz.compressDir(destPath, tgzPath)
  /** 7. 创建oss上传链接 */
  const client = createOss()
  /** 8. 把压缩包上传到对应包文件目录里面 */
  await client.multipartUpload(`${name}/${tgzName}`, fs.readFileSync(tgzPath))
  console.log('打包部署完成, 包文件oss地址为: ', `${ossHost}/${name}/${tgzName}`)
  /** 9. 异步删除packages文件夹 */
  fs.remove(packagesPath)
}


/** 监听Promise的reject时间，抛出异常 */
process.on('unhandledRejection', (p) => {
  throw p
})
