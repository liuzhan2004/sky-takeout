package com.sky.config;

import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.ReflectionUtils;
import org.springframework.web.servlet.mvc.method.RequestMappingInfoHandlerMapping;
import springfox.documentation.spring.web.plugins.WebFluxRequestHandlerProvider;
import springfox.documentation.spring.web.plugins.WebMvcRequestHandlerProvider;

import java.lang.reflect.Field;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 解决 Spring Boot 2.6+ 默认使用 PathPatternParser 导致 Springfox 启动报
 * NullPointerException: Cannot invoke "PatternsRequestCondition.getPatterns()" 的问题。
 * <p>
 * 做法：在 Springfox 收集接口时，过滤掉所有基于 PathPatternParser 的 HandlerMapping，
 * 只保留基于 AntPathMatcher 的，从而避免 PatternsRequestCondition 为 null。
 */
@Configuration
public class SwaggerConfigFix {

    @Bean
    public static BeanPostProcessor springfoxHandlerProviderBeanPostProcessor() {
        return new BeanPostProcessor() {
            @Override
            public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
                if (bean instanceof WebMvcRequestHandlerProvider || bean instanceof WebFluxRequestHandlerProvider) {
                    customizeSpringfoxHandlerMappings(getHandlerMappings(bean));
                }
                return bean;
            }
        };
    }

    private static void customizeSpringfoxHandlerMappings(List<RequestMappingInfoHandlerMapping> mappings) {
        List<RequestMappingInfoHandlerMapping> copy = mappings.stream()
                .filter(mapping -> mapping.getPatternParser() == null)
                .collect(Collectors.toList());
        mappings.clear();
        mappings.addAll(copy);
    }

    private static List<RequestMappingInfoHandlerMapping> getHandlerMappings(Object bean) {
        try {
            Field field = ReflectionUtils.findField(bean.getClass(), "handlerMappings");
            field.setAccessible(true);
            return (List<RequestMappingInfoHandlerMapping>) field.get(bean);
        } catch (IllegalArgumentException | IllegalAccessException e) {
            throw new IllegalStateException(e);
        }
    }
}
