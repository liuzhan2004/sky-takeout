package com.sky.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.github.pagehelper.Page;
import com.github.pagehelper.PageHelper;
import com.sky.cache.CacheService;
import com.sky.constant.MessageConstant;
import com.sky.constant.StatusConstant;
import com.sky.dto.DishDTO;
import com.sky.dto.DishPageQueryDTO;
import com.sky.entity.Dish;
import com.sky.entity.DishFlavor;
import com.sky.entity.Setmeal;
import com.sky.exception.DeletionNotAllowedException;
import com.sky.json.JacksonObjectMapper;
import com.sky.mapper.DishFlavorMapper;
import com.sky.mapper.DishMapper;
import com.sky.mapper.SetmealDishMapper;
import com.sky.mapper.SetmealMapper;
import com.sky.result.PageResult;
import com.sky.service.DishService;
import com.sky.vo.DishVO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
//todo手写式写，清缓存
public class DishServiceImpl implements DishService {

    @Autowired
    private DishMapper dishMapper;
    @Autowired
    private DishFlavorMapper dishFlavorMapper;
    @Autowired
    private SetmealDishMapper setmealDishMapper;
    @Autowired
    private SetmealMapper setmealMapper;
    @Autowired
    private CacheService cacheClearUtil;
    @Autowired
    private StringRedisTemplate stringRedisTemplate;
    @Autowired
    private JacksonObjectMapper objectMapper;


    /**
     * 新增菜品和对应的口味
     *
     * @param dishDTO
     */
//    todo事务和缓存分离
    public void saveWithFlavor(DishDTO dishDTO) {
        this.saveWithFlavorInx(dishDTO);
        // TODO 这个清理缓存不能和事件写在一起，需要分开抽取出来
        cacheClearUtil.clearCategoryCache();
    }
    @Transactional
    public void saveWithFlavorInx(DishDTO dishDTO) {
        Dish dish = new Dish();

        BeanUtils.copyProperties(dishDTO, dish);

        //向菜品表插入1条数据
        dishMapper.insert(dish);

        //获取insert语句生成的主键值
        Long dishId = dish.getId();

        List<DishFlavor> flavors = dishDTO.getFlavors();
        if (flavors != null && flavors.size() > 0) {
            flavors.forEach(dishFlavor -> {
                dishFlavor.setDishId(dishId);
            });
            //向口味表插入n条数据
            dishFlavorMapper.insertBatch(flavors);
        }
        // TODO 这个清理缓存不能和事件写在一起，需要分开抽取出来
        cacheClearUtil.clearCategoryCache();
    }

    /**
     * 菜品分页查询
     *
     * @param dishPageQueryDTO
     * @return
     */
    public PageResult pageQuery(DishPageQueryDTO dishPageQueryDTO) {
        PageHelper.startPage(dishPageQueryDTO.getPage(), dishPageQueryDTO.getPageSize());
        Page<DishVO> page = dishMapper.pageQuery(dishPageQueryDTO);
        return new PageResult(page.getTotal(), page.getResult());
    }

    /**
     * 菜品批量删除
     *
     * @param ids
     */
    @Transactional
    public void deleteBatch(List<Long> ids) {
        //判断当前菜品是否能够删除---是否存在起售中的菜品？？
        for (Long id : ids) {
            Dish dish = dishMapper.getById(id);
            if (dish.getStatus() == StatusConstant.ENABLE) {
                //当前菜品处于起售中，不能删除
                throw new DeletionNotAllowedException(MessageConstant.DISH_ON_SALE);
            }
        }

        //判断当前菜品是否能够删除---是否被套餐关联了？？
        List<Long> setmealIds = setmealDishMapper.getSetmealIdsByDishIds(ids);
        if (setmealIds != null && setmealIds.size() > 0) {
            //当前菜品被套餐关联了，不能删除
            throw new DeletionNotAllowedException(MessageConstant.DISH_BE_RELATED_BY_SETMEAL);
        }

        //删除菜品表中的菜品数据
        for (Long id : ids) {
            dishMapper.deleteById(id);
            //删除菜品关联的口味数据
            dishFlavorMapper.deleteByDishId(id);
        }
        // TODO 这个清理缓存不能和事件写在一起，需要分开抽取出来
        cacheClearUtil.clearCategoryCache();
    }

    /**
     * 根据id查询菜品和对应的口味数据
     *
     * @param id
     * @return
     */
    public DishVO getByIdWithFlavor(Long id) {
        //根据id查询菜品数据
        Dish dish = dishMapper.getById(id);

        //根据菜品id查询口味数据
        List<DishFlavor> dishFlavors = dishFlavorMapper.getByDishId(id);

        //将查询到的数据封装到VO
        DishVO dishVO = new DishVO();
        BeanUtils.copyProperties(dish, dishVO);
        dishVO.setFlavors(dishFlavors);

        return dishVO;
    }

    /**
     * 根据id修改菜品基本信息和对应的口味信息
     *
     * @param dishDTO
     */
    public void updateWithFlavor(DishDTO dishDTO) {
        Dish dish = new Dish();
        BeanUtils.copyProperties(dishDTO, dish);

        //修改菜品表基本信息
        dishMapper.update(dish);

        //删除原有的口味数据
        dishFlavorMapper.deleteByDishId(dishDTO.getId());

        //重新插入口味数据
        List<DishFlavor> flavors = dishDTO.getFlavors();
        if (flavors != null && flavors.size() > 0) {
            flavors.forEach(dishFlavor -> {
                dishFlavor.setDishId(dishDTO.getId());
            });
            //向口味表插入n条数据
            dishFlavorMapper.insertBatch(flavors);
        }

        cacheClearUtil.clearCategoryCache();
    }

    /**
     * 菜品起售停售
     *
     * @param status
     * @param id
     */
    @Transactional
    public void startOrStop(Integer status, Long id) {
        Dish dish = Dish.builder()
                .id(id)
                .status(status)
                .build();
        dishMapper.update(dish);

        if (status == StatusConstant.DISABLE) {
            // 如果是停售操作，还需要将包含当前菜品的套餐也停售
            List<Long> dishIds = new ArrayList<>();
            dishIds.add(id);
            // select setmeal_id from setmeal_dish where dish_id in (?,?,?)
            List<Long> setmealIds = setmealDishMapper.getSetmealIdsByDishIds(dishIds);
            if (setmealIds != null && setmealIds.size() > 0) {
                for (Long setmealId : setmealIds) {
                    Setmeal setmeal = Setmeal.builder()
                            .id(setmealId)
                            .status(StatusConstant.DISABLE)
                            .build();
                    setmealMapper.update(setmeal);
                }
            }
        }
        // TODO 这个清理缓存不能和事件写在一起，需要分开抽取出来
        cacheClearUtil.clearCategoryCache();
    }

    /**
     * 根据分类id查询菜品
     *
     * @param categoryId
     * @return
     */
    public List<Dish> list(Long categoryId) {
        Dish dish = Dish.builder()
                .categoryId(categoryId)
                .status(StatusConstant.ENABLE)
                .build();
        return dishMapper.list(dish);
    }

    /**
     * 条件查询菜品和口味
     * @param dish
     * @return
     */
//    TODO理解
    public List<DishVO> listWithFlavor(Dish dish) {
        Long categoryId = dish.getCategoryId();
        if (categoryId == null) {
            // 防御性编程，如果没有传分类id，按原有逻辑走（或抛出异常）
            return fetchFromDB(dish);
        }

        // 3. 构建缓存的 key，例如 "dish_flavor_list_3"
        String cacheKey = "dish_flavor_list_" + categoryId;

        // 4. 尝试从 StringRedisTemplate 中读取数据（得到的是 JSON 字符串）
        String cachedJson = stringRedisTemplate.opsForValue().get(cacheKey);

        // 5. 如果缓存中有数据，直接反序列化并返回，不查数据库
        if (cachedJson != null && !cachedJson.isEmpty()) {
            try {
                // 使用 TypeReference 完美支持 List<DishVO> 等复杂泛型的反序列化
                return objectMapper.readValue(cachedJson, new TypeReference<List<DishVO>>() {});
            } catch (Exception e) {
                e.printStackTrace();
                // 反序列化失败，降级为查数据库
            }
        }

        // 6. 缓存中没有数据（未命中），查询数据库
        List<DishVO> result = fetchFromDB(dish);

        // 7. 将查到的数据序列化为 JSON 字符串，写入 Redis
        try {
            String jsonToCache = objectMapper.writeValueAsString(result);
            // 设置一个合理的过期时间，比如 30 分钟，防止缓存雪崩
            stringRedisTemplate.opsForValue().set(cacheKey, jsonToCache, 30, TimeUnit.MINUTES);
        } catch (Exception e) {
            e.printStackTrace();
            // 存入缓存失败不影响业务流程，记录日志即可
        }

        return result;
    }

    /**
     * 抽离出原有的查库逻辑
     */
    private List<DishVO> fetchFromDB(Dish dish) {
        List<Dish> dishList = dishMapper.list(dish);
        List<DishVO> dishVOList = new ArrayList<>();

        for (Dish d : dishList) {
            DishVO dishVO = new DishVO();
            // 假设项目中使用了 Spring 的 BeanUtils 或者 Hutool 的 BeanUtil
            org.springframework.beans.BeanUtils.copyProperties(d, dishVO);

            // 根据菜品id查询对应的口味
            List<DishFlavor> flavors = dishFlavorMapper.getByDishId(d.getId());

            dishVO.setFlavors(flavors);
            dishVOList.add(dishVO);
        }
        return dishVOList;
    }
//    public List<DishVO> listWithFlavor(Dish dish) {
//        List<Dish> dishList = dishMapper.list(dish);
//
//        List<DishVO> dishVOList = new ArrayList<>();
//
//        for (Dish d : dishList) {
//            DishVO dishVO = new DishVO();
//            BeanUtils.copyProperties(d,dishVO);
//
//            //根据菜品id查询对应的口味
//            List<DishFlavor> flavors = dishFlavorMapper.getByDishId(d.getId());
//
//            dishVO.setFlavors(flavors);
//            dishVOList.add(dishVO);
//        }
//
//        return dishVOList;
//    }
}
