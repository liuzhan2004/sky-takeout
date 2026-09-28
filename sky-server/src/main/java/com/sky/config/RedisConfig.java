package com.sky.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.cache.RedisCacheWriter;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.Jackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.Random;

import static org.springframework.data.redis.cache.RedisCacheConfiguration.defaultCacheConfig;

@Slf4j
@Configuration
//@Primary
//适配SpringCache注释 将对象转成json格式，设置过期时间 RedisCacheManager 防雪崩
public class RedisConfig {

    // 定义一个全局随机数生成器
    private static final Random RANDOM = new Random();
    /**
     * 配置 Spring Cache 注解专用的缓存管理器
     * 解决 @Cacheable 存入 Redis 时出现二进制乱码的问题
     */
    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory redisConnectionFactory) {

        // 1. 配置 Key 的序列化（使用 StringRedisSerializer）
        // 2. 配置 Value 的序列化（使用 Jackson 序列化为 JSON）
        Jackson2JsonRedisSerializer<Object> jacksonSerializer = new Jackson2JsonRedisSerializer<>(Object.class);
        ObjectMapper om = new ObjectMapper();
// 注册 Java 8 日期时间模块，解决 LocalDateTime 报错
        om.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
        om.activateDefaultTyping(om.getPolymorphicTypeValidator(), ObjectMapper.DefaultTyping.NON_FINAL);
        jacksonSerializer.setObjectMapper(om);

        // 使用全路径名，绝对不会混淆
        org.springframework.data.redis.cache.RedisCacheConfiguration config =
                defaultCacheConfig()
                        .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                        .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(jacksonSerializer))
                        .disableCachingNullValues() // 不缓存 null 值
                        .entryTtl(Duration.ofMinutes(30).plusSeconds(RANDOM.nextInt(120))); //、

        // 2. 创建不同业务场景的专属配置
        RedisCacheConfiguration setmealConfig = defaultCacheConfig().entryTtl(Duration.ofMinutes(30).plusSeconds(RANDOM.nextInt(120)));     // 套餐缓存30分钟
        // 构建 RedisCacheManager
        RedisCacheManager cacheManager = RedisCacheManager.builder(redisConnectionFactory)
                .cacheDefaults(config)
                .withCacheConfiguration("setmeal", setmealConfig)
                .build();
        return cacheManager;
    }
}
