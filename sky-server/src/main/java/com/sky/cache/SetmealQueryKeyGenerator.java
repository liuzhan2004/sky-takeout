package com.sky.cache;
import org.springframework.beans.BeanWrapper;
import org.springframework.beans.BeanWrapperImpl;
import org.springframework.cache.interceptor.KeyGenerator;
import org.springframework.stereotype.Component;

import java.beans.PropertyDescriptor;
import java.lang.reflect.Method;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

/**Spring Cache 缓存 Key 的“专属翻译官”
 * C端动态条件查询专用 KeyGenerator
 * 规则：提取DTO中所有非null属性，按字段名排序拼接；全null时返回"ALL"
 */
//查
@Component("setmealQueryKeyGenerator")
public class SetmealQueryKeyGenerator implements KeyGenerator {

    @Override
    public Object generate(Object target, Method method, Object... params) {
        // 1. 获取第一个参数（你的查询DTO）
        Object param = params[0];
        Map<String, Object> conditions = new LinkedHashMap<>();

        // 2. 使用 BeanWrapper 安全读取 DTO 的所有属性
        BeanWrapper wrapper = new BeanWrapperImpl(param);
        for (PropertyDescriptor pd : wrapper.getPropertyDescriptors()) {
            String name = pd.getName();

            // ⚠️ 必须跳过 "class" 属性，否则会把类信息拼进Key里
            if ("class".equals(name)) {
                continue;
            }

            // 3. 只收集非 null 的属性值
            Object value = wrapper.getPropertyValue(name);
            if (value != null) {
                conditions.put(name, value);
            }
        }

        // 4. 按字段名排序后拼接，保证顺序无关性
        String key = conditions.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> e.getKey() + "=" + e.getValue())
                .collect(Collectors.joining("&"));

        // 5. 所有参数都为null时，返回固定兜底Key
        return key.isEmpty() ? "ALL" : key;
    }
}