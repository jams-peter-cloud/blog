# 🔥 用Python打造Windows系统垃圾清理工具

## 前言

日常使用Windows系统过程中，会产生大量临时文件、日志文件、缓存文件等垃圾数据，不仅占用磁盘空间，还可能影响系统运行效率。本文将分享一个纯Python编写的系统垃圾清理工具，无需安装第三方清理软件，一键扫描并清理各类垃圾文件，还支持清理scoop、pip缓存及回收站，轻量化且高效。

## 📋 工具核心功能

1. 扫描并删除指定后缀的垃圾文件（临时文件、日志文件、备份文件等）

2. 清理%TEMP%系统临时文件夹

3. 清理scoop包管理器缓存、pip缓存

4. 清空系统回收站

5. 统计垃圾文件数量及占用空间大小

## 🛠️ 完整代码实现

``` python

import os

import subprocess

import send2trash

# 定义需要清理的文件后缀及对应说明

del_extension = {

'.tmp': '临时文件',

'._mp': '临时文件_mp',

'.log': '日志文件',

'.gid': '临时帮助文件',

'.chk': '磁盘检查文件',

'.old': '临时备份文件',

'.xlk': 'Excel备份文件',

'.bak': '临时备份文件bak'

}

# 用户目录下需清理的文件夹（本文示例未实现该部分，可扩展）

del_userprofile = ['cookies','recent', 'Temporary Internet Files', 'Temp']

# 系统目录下需清理的文件夹（本文示例未实现该部分，可扩展）

del_windir = ['prefetch', 'temp']

# 获取系统环境变量路径

SYS_DRIVE = os.environ['systemdrive'] + '\\'

USER_PROFILE = os.environ['userprofile']

WIN_DIR = os.environ['windir']

TEMP_DIR = os.environ.get('TEMP', '')

def del_dir_or_file(root):

"""

删除文件/文件夹通用函数

:param root: 文件/文件夹路径

"""

try:

if os.path.isfile(root):

os.remove(root)

print("file", root, "removed")

elif os.path.isdir(root):

os.rmdir(root)

print("dir", root, "removed")

except WindowsError:

print("failure", root, "can't remove")

def formatSize(b):

"""

字节单位转换（B -> KB/MB/GB）

:param b: 原始字节数

:return: 格式化后的大小字符串

"""

try:

kb = b // 1024

except:

print("传入字节格式不对")

return "Error"

if kb > 1024:

M = kb // 1024

if M > 1024:

G = M // 1024

return "%dG" % G

else:

return "%dM" % M

else:

return "%dkb" % kb

class DiskClean(object):

"""系统垃圾清理核心类"""

def __init__(self):

self.del_info = {}  # 存储各类型垃圾文件统计信息

self.del_file_paths = []  # 存储待删除文件路径

self.total_size = 0  # 垃圾文件总大小

# 初始化统计字典

for i, j in del_extension.items():

self.del_info[i] = dict(name=j, count=0, size=0)

def scanf(self):

"""扫描用户目录下指定后缀的垃圾文件"""

for roots, dirs, files in os.walk(USER_PROFILE):

for files_item in files:

file_extension = os.path.splitext(files_item)[1]

if file_extension in self.del_info:

file_full_path = os.path.join(roots, files_item)

self.del_file_paths.append(file_full_path)

self.del_info[file_extension]['count'] += 1

file_size = os.path.getsize(file_full_path)

self.del_info[file_extension]['size'] += file_size

self.total_size += file_size

def show(self):

"""展示扫描结果（各类型文件数量、大小）"""

re = formatSize(self.total_size)

for i in self.del_info:

size_str = formatSize(self.del_info[i]['size'])

print(self.del_info[i]["name"], "共计", self.del_info[i]["count"], "个，大小为", size_str)

return re

def delete_files(self):

"""删除扫描到的垃圾文件"""

for i in self.del_file_paths:

print(i)

del_dir_or_file(i)

def run_external_commands(self):

"""执行外部清理命令+清理临时文件夹+清空回收站"""

try:

# 清理scoop缓存

subprocess.run(['scoop', 'cleanup', '*'], check=True)

print("scoop cleanup * 执行成功")

subprocess.run(['scoop', 'clean'], check=True)

print("scoop clean 执行成功")

subprocess.run(['scoop', 'cache', 'rm', '*'], check=True)

print("scoop cache rm * 执行成功")

# 清理pip缓存

subprocess.run(['pip', 'cache', 'purge'], check=True)

print("pip cache purge 执行成功")

except subprocess.CalledProcessError as e:

print(f"执行外部命令出错: {e}")

# 清空%temp%文件夹

if TEMP_DIR:

for root, dirs, files in os.walk(TEMP_DIR, topdown=False):

for file in files:

file_path = os.path.join(root, file)

try:

os.unlink(file_path)

except Exception as e:

print(f"删除文件 {file_path} 失败: {e}")

for dir in dirs:

dir_path = os.path.join(root, dir)

try:

os.rmdir(dir_path)

except Exception as e:

print(f"删除目录 {dir_path} 失败: {e}")

print("%temp%文件夹清空成功")

# 清理回收站

try:

send2trash.send2trash('C:\\$Recycle.Bin')

print("回收站清理成功")

except Exception as e:

print(f"清理回收站失败: {e}")

if __name__ == "__main__":

print("初始化清理垃圾程序")

cleaner = DiskClean()

print("开始扫描垃圾文件请耐心等待\n")

cleaner.scanf()

print("扫描成功，结果如下")

re = cleaner.show()

cleaner.delete_files()

cleaner.run_external_commands()

'''