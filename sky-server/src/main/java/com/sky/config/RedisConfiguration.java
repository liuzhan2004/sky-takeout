package com.sky.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.Jackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
@Slf4j
//适配手写redis  解决乱码  RedisTemplate
public class RedisConfiguration {
    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory redisConnectionFactory) {
        log.info("开始创建redis模板对象...");
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(redisConnectionFactory);

        // 1. Key 使用 String 序列化
        template.setKeySerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());

//        创建 ObjectMapper 核心组件
        // 2. Value 使用 Jackson JSON 序列化
        ObjectMapper objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule()); // 处理 Java 8 时间
        // 防止反序列化时因为缺少默认构造函数或未知字段报错
        objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

//        创建真正的“转换器” (GenericJackson2JsonRedisSerializer)
        GenericJackson2JsonRedisSerializer jsonSerializer = new GenericJackson2JsonRedisSerializer(objectMapper);

//        负责普通 Value（比如字符串、对象）的存取
        template.setValueSerializer(jsonSerializer);
//        负责 Hash（哈希）类型的 Value 存取
        template.setHashValueSerializer(jsonSerializer);

        template.afterPropertiesSet(); // 确保配置生效
        return template;
    }
//    @Bean
//    public RedisTemplate redisTemplate(RedisConnectionFactory redisConnectionFactory) {
//        log.info("开始创建redis模板对象...");
//        RedisTemplate redisTemplate = new RedisTemplate();
//        //设置redis的连接工厂对象
//        redisTemplate.setConnectionFactory(redisConnectionFactory);
//        //设置redis key的序列化器
//        redisTemplate.setKeySerializer(new StringRedisSerializer());
//        //设置redis value的序列化器，解决乱码问题
//        // redisTemplate.setValueSerializer(new StringRedisSerializer()); // 注释掉原来的
//
//        // 1. 创建 ObjectMapper 对象
//        ObjectMapper objectMapper = new ObjectMapper();
//        // 2. 注册一个处理 Java 8 时间类型的模块
//        objectMapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
//
//        // 3. 把配置好的 ObjectMapper 传给 Redis 的序列化器
//        Jackson2JsonRedisSerializer<Object> jackson2JsonRedisSerializer = new Jackson2JsonRedisSerializer<>(Object.class);
//        jackson2JsonRedisSerializer.setObjectMapper(objectMapper);
//
//        // 4. 设置 Redis 的 value 序列化器
//        redisTemplate.setValueSerializer(jackson2JsonRedisSerializer);
//
//        return redisTemplate;
//    }
//    @Bean
//    public RedisTemplate redisTemplate(RedisConnectionFactory redisConnectionFactory){
//        log.info("开始创建redis模板对象...");
//        RedisTemplate redisTemplate = new RedisTemplate();
//        //设置redis的连接工厂对象
//        redisTemplate.setConnectionFactory(redisConnectionFactory);
//        //设置redis key的序列化器
//        redisTemplate.setKeySerializer(new StringRedisSerializer());
//        // 【新增】设置redis value的序列化器，解决乱码问题
////        redisTemplate.setValueSerializer(new StringRedisSerializer());
//        redisTemplate.setValueSerializer(new GenericJackson2JsonRedisSerializer());
//        return redisTemplate;
//    }

}
