-- 永远的花园 · 补丁：禁止访客直接调用 pet3d_reserve，并清理测试数据
-- 整份复制到 Supabase → SQL Editor → Run。可以重复执行。
-- 说明：上次的建表脚本只收回了 PUBLIC 的执行权，但 Supabase 还会默认把新函数
-- 的执行权交给 anon / authenticated，所以浏览器里的公开密钥也能直接预约生成。
-- 本补丁把执行权只留给 service_role（云函数用），并删掉验证时留下的测试行。

begin;

revoke all on function public.pet3d_reserve(uuid, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.pet3d_reserve(uuid, text, text, text, text, text, text, text)
  to service_role;

-- 验证脚本误创建的预约任务（以及同一台验证设备 / 同名未真正生成的测试行）
delete from public.pet3d_jobs
 where id = '47ee12f8-aab5-489b-b306-575bbd6565a0'
    or device = 'verifydevice1'
    or (
         name = 'test'
         and meshy_task_id is null
         and status in ('queued', 'failed')
         and created_at >= '2026-11-18 23:50:00+00'
         and created_at <  '2026-11-19 01:00:00+00'
       );

-- 若石雕狗附近有「验证脚本」留下的测试花，才删除。
-- 无法仅凭时间判断是否为测试（献花没有文字），因此只删 device 像 verify- / test 的行。
-- 普通访客在 23:20 左右献的花不会被删。
delete from public.rituals
 where spot = 'statue'
   and kind = 'flower'
   and created_at >= '2026-11-18 23:15:00+00'
   and created_at <  '2026-11-18 23:35:00+00'
   and (
     device like 'verify-%'
     or device like 'verifydevice%'
     or device like 'test%'
     or coalesce(text, '') like '%测试%'
     or coalesce(text, '') like '%【测试】%'
   );

commit;

notify pgrst, 'reload schema';
