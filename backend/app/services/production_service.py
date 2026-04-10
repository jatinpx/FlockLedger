EGGS_PER_TRAY = 30


def usable_eggs(eggs_produced: int, broken_eggs: int) -> int:
    return max(0, eggs_produced - broken_eggs)


def trays_from_eggs(eggs: int) -> int:
    return eggs // EGGS_PER_TRAY if eggs > 0 else 0
