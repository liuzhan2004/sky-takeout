package com.sky.lock;


import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Component
public class RedisLockService {
    private final StringRedisTemplate stringRedisTemplate;

    // 1. 定义解锁时使用的 Lua 脚本（保证“判断”和“删除”是原子操作）
    // 逻辑：如果 Redis 里的值 == 传入的 uuid，则删除锁；否则什么都不做。
    private static final String UNLOCK_SCRIPT =
            "if redis.call('get', KEYS[1]) == ARGV[1] then " +
                    "    return redis.call('del', KEYS[1]) " +
                    "else " +
                    "    return 0 " +
                    "end";

    // 2. 使用 ThreadLocal 安全地保存当前线程获取到的 UUID
    // 保证线程A存的UUID，只有线程A自己能用，绝对不会和线程B混淆。
    private static final ThreadLocal<String> THREAD_UUID_LOCAL = new ThreadLocal<>();

    public RedisLockService(StringRedisTemplate stringRedisTemplate) {
        this.stringRedisTemplate = stringRedisTemplate;
    }

    /**
     * 尝试获取分布式锁
     * @param key 锁的Key（例如 "lock:order:1001"）
     * @param expireTime 锁的过期时间（秒，防止死锁）
     * @return 是否成功获取锁
     */
    public boolean tryLock(String key, int expireTime) {
        // 1. 生成全局唯一标识 UUID
        String uuid = UUID.randomUUID().toString();

        // 2. 尝试在 Redis 中设置 key（NX: 不存在才设置, EX: 过期时间）
        Boolean acquired = stringRedisTemplate.opsForValue()
                .setIfAbsent(key, uuid, expireTime, TimeUnit.SECONDS);

        // 3. 如果获取锁成功，将 UUID 存入当前线程的 ThreadLocal 中
        if (Boolean.TRUE.equals(acquired)) {
            THREAD_UUID_LOCAL.set(uuid);
            return true;
        }
        return false;
    }

    /**
     * 安全释放分布式锁
     * @param key 锁的Key
     */
    public void unlock(String key) {
        // 1. 从当前线程的 ThreadLocal 中取出当初存入的 UUID
        String uuid = THREAD_UUID_LOCAL.get();

        if (uuid != null) {
            try {
                // 2. 使用 Lua 脚本安全地释放锁（只有当 Redis 里的值等于自己的 UUID 时，才删除）
                DefaultRedisScript<Long> script = new DefaultRedisScript<>(UNLOCK_SCRIPT, Long.class);
                stringRedisTemplate.execute(script, Collections.singletonList(key), uuid);
            } finally {
                // 3. 【极其重要】无论解锁成功与否，必须清理 ThreadLocal！
                // 因为 Web 容器（如 Tomcat）使用的是线程池，线程会被复用，
                // 如果不清理，会导致内存泄漏，甚至下一个请求读到上一个请求的 UUID！
                THREAD_UUID_LOCAL.remove();
            }
        }
    }
}
