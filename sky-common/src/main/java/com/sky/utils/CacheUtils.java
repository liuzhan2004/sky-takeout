package com.sky.utils;

import org.springframework.stereotype.Component;

import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
@Component
public class CacheUtils {
//    返回总秒数
    public static long getTtlWithRandom(long baseTtl, TimeUnit unit, int offsetBound) {
        // 统一转成秒
        long baseSeconds = unit.toSeconds(baseTtl);
        // 生成 0 到 offsetBound 之间的随机秒数
        long randomSeconds =ThreadLocalRandom.current().nextInt(offsetBound);
        return baseSeconds + randomSeconds;
    }
}
