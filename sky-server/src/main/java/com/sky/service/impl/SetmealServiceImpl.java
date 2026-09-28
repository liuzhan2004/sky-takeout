package com.sky.service.impl;

import com.github.pagehelper.Page;
import com.github.pagehelper.PageHelper;
import com.sky.cache.CacheService;
import com.sky.constant.MessageConstant;
import com.sky.constant.StatusConstant;
import com.sky.dto.SetmealDTO;
import com.sky.dto.SetmealPageQueryDTO;
import com.sky.entity.Dish;
import com.sky.entity.Setmeal;
import com.sky.entity.SetmealDish;
import com.sky.exception.DeletionNotAllowedException;
import com.sky.exception.SetmealEnableFailedException;
import com.sky.mapper.DishMapper;
import com.sky.mapper.SetmealDishMapper;
import com.sky.mapper.SetmealMapper;
import com.sky.result.PageResult;
import com.sky.service.SetmealService;
import com.sky.vo.DishItemVO;
import com.sky.vo.SetmealVO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 套餐业务实现
 */
@Service
@Slf4j
//todo注解式写缓存和清缓存
public class SetmealServiceImpl implements SetmealService {

    @Autowired
    private SetmealMapper setmealMapper;
    @Autowired
    private SetmealDishMapper setmealDishMapper;
    @Autowired
    private DishMapper dishMapper;
    @Autowired
    private CacheService cacheService;

    /**
     * 新增套餐，同时需要保存套餐和菜品的关联关系
     *
     * @param setmealDTO
     */
//    事务缓存分离
    //TODO 将一个列表里的属性copy到另外一个列表，重点理解
    @Transactional
    public void saveWithDishInx(SetmealDTO setmealDTO) {
        // 1. 处理套餐基本信息
        Setmeal setmeal = new Setmeal();
        BeanUtils.copyProperties(setmealDTO, setmeal);

        // 向套餐表插入数据
        setmealMapper.insert(setmeal);

        // 获取生成的套餐id
        Long setmealId = setmeal.getId();

        // 2. 处理套餐与菜品的关联
        List<SetmealDish> setmealDishes = setmealDTO.getSetmealDishes();

        // 设置套餐ID
        setmealDishes.forEach(setmealDish -> {
            setmealDish.setSetmealId(setmealId);
        });

        try {
            // 1. 直接从已有的 setmealDishes 中提取出所有的菜品ID
            List<Long> dishIds = setmealDishes.stream()
                    .map(SetmealDish::getDishId)
                    .collect(Collectors.toList());

            // 2. 拿着ID去数据库查出最新的菜品名称和价格 (注意这里用 Dish 接收)
            List<Dish> dishes = dishMapper.getNamePriceByDishId(dishIds);
            System.out.println("从dish表拿到了"+dishes);

            // 3. 把查出来的 Dish 结果，转成以 id 为 Key 的 Map 字典
            Map<Long, Dish> dishMap = dishes.stream()
                    .collect(Collectors.toMap(
                            Dish::getId, // 注意这里用 Dish 的 getId
                            dish -> dish,
                            (existing, replacement) -> existing
                    ));

            // 4. 遍历前端传来的列表，把 Map 里查到的 name 和 price 赋值给 SetmealDish
            setmealDishes.forEach(setmealDish -> {
                // 根据 dishId 去 Map 里找
                Dish dbDish = dishMap.get(setmealDish.getDishId());
                if (dbDish != null) {
                    setmealDish.setName(dbDish.getName());
                    setmealDish.setPrice(dbDish.getPrice());
                }
            });

            // 5. 【最后一次】执行批量插入（确保上面只保留这最后一行 insertBatch）
            setmealDishMapper.insertBatch(setmealDishes);

            System.out.println("赋值后的数据：" + setmealDishes);


        } catch (Exception e) {
            // 打印异常堆栈信息，方便调试查看具体报错
            e.printStackTrace();
            // 如果是业务逻辑，通常这里需要手动抛出运行时异常，触发 Spring 事务回滚
            throw new RuntimeException("保存套餐及菜品关联关系失败", e);
        }
    }
    public void saveWithDish(SetmealDTO setmealDTO) {
        this.saveWithDishInx(setmealDTO);
        cacheService.setmealEvictAll();
    }


    /**
     * 分页查询
     * admin
     * @param setmealPageQueryDTO
     * @return
     */
//不需要redis
    public PageResult pageQuery(SetmealPageQueryDTO setmealPageQueryDTO) {
        int pageNum = setmealPageQueryDTO.getPage();
        int pageSize = setmealPageQueryDTO.getPageSize();

        PageHelper.startPage(pageNum, pageSize);
        Page<SetmealVO> page = setmealMapper.pageQuery(setmealPageQueryDTO);
        return new PageResult(page.getTotal(), page.getResult());
    }


    /**
     * 批量删除套餐
     *
     * @param ids
     */
//    事务缓存分离
    @Transactional
    public void deleteBatchIn(List<Long> ids) {
        ids.forEach(id -> {
            Setmeal setmeal = setmealMapper.getById(id);
            if (StatusConstant.ENABLE == setmeal.getStatus()) {
                //起售中的套餐不能删除
                throw new DeletionNotAllowedException(MessageConstant.SETMEAL_ON_SALE);
            }
        });

        ids.forEach(setmealId -> {
            //删除套餐表中的数据
            setmealMapper.deleteById(setmealId);
            //删除套餐菜品关系表中的数据
            setmealDishMapper.deleteBySetmealId(setmealId);
        });
    }
    public void deleteBatch(List<Long> ids) {
        this.deleteBatchIn(ids);
        cacheService.setmealEvictAll();
    }



    /**
     * 根据id查询套餐和套餐菜品关系
     *
     * @param id
     * @return
     */
//    不需要redis
    public SetmealVO getByIdWithDish(Long id) {
        SetmealVO setmealVO = setmealMapper.getByIdWithDish(id);
        return setmealVO;
    }

    /**
     * 修改套餐
     *
     * @param setmealDTO
     */
//    事务缓存分离
    @Transactional
    public void updateInx(SetmealDTO setmealDTO) {
        Setmeal setmeal = new Setmeal();
        BeanUtils.copyProperties(setmealDTO, setmeal);

        //1、修改套餐表，执行update
        setmealMapper.update(setmeal);

        //套餐id
        Long setmealId = setmealDTO.getId();

        //2、删除套餐和菜品的关联关系，操作setmeal_dish表，执行delete
        setmealDishMapper.deleteBySetmealId(setmealId);

        List<SetmealDish> setmealDishes = setmealDTO.getSetmealDishes();
        setmealDishes.forEach(setmealDish -> {
            setmealDish.setSetmealId(setmealId);
        });
        //3、重新插入套餐和菜品的关联关系，操作setmeal_dish表，执行insert
        setmealDishMapper.insertBatch(setmealDishes);
    }
    public void update(SetmealDTO setmealDTO) {
        this.updateInx(setmealDTO);
        cacheService.setmealEvictAll();
    }


    /**
     * 套餐起售、停售
     *
     * @param status
     * @param id
     */
//    事件缓存分离
    @Transactional(rollbackFor = Exception.class)
    public void startOrStopInx(Integer status, Long id) {
        //起售套餐时，判断套餐内是否有停售菜品，有停售菜品提示"套餐内包含未启售菜品，无法启售"
        if (status == StatusConstant.ENABLE) {
            //select a.* from dish a left join setmeal_dish b on a.id = b.dish_id where b.setmeal_id = ?
            List<Dish> dishList = dishMapper.getBySetmealId(id);
            if (dishList != null && dishList.size() > 0) {
                dishList.forEach(dish -> {
                    if (StatusConstant.DISABLE == dish.getStatus()) {
                        throw new SetmealEnableFailedException(MessageConstant.SETMEAL_ENABLE_FAILED);
                    }
                });
            }
        }
        Setmeal setmeal = Setmeal.builder()
                .id(id)
                .status(status)
                .build();
        setmealMapper.update(setmeal);
    }
    public void startOrStop(Integer status, Long id) {
        this.startOrStopInx(status, id);
        cacheService.setmealEvictAll();

    }

    /**
     * 条件查询
     * @param setmeal
     * @return
     */
//    keyGenerator适用于查询接口多个参数
    @Cacheable(value = "setmeal",keyGenerator ="setmealQueryKeyGenerator")
    public List<Setmeal> list(Setmeal setmeal) {
        List<Setmeal> list = setmealMapper.list(setmeal);
        return list;
    }

    /**
     * 根据id查询菜品选项
     * @param id
     * @return
     */
//    访问频率相对较低（用不上），不需要redis
    @Cacheable(value = "dish",keyGenerator ="setmealQueryKeyGenerator")
    public List<DishItemVO> getDishItemById(Long id) {
        return setmealMapper.getDishItemBySetmealId(id);
    }
}
